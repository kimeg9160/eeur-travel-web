import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const CONTAINER_SELECTOR = ".m6QErb.DxyBCb.kA9KIf.dS8AEf";

const KNOWN_CATEGORIES = [
  "박물관", "정원", "역사적 명소", "대성당", "요새", "상점", "관광 안내소",
  "명승지", "제과점", "관광 명소", "성곽", "미술관", "놀이공원", "음식점",
  "오스트리아 요리", "핫도그 판매 노점", "핫도그 판매대", "산악 케이블카",
  "천주교 성당", "역사적 장소",
];

const SKIP_PATTERNS = [/^\d\.\d$/, /^\([\d,]+\)$/, /^€/, /^₩/, /^·$/];

function classifyCategory(texts: string[]): string {
  const joined = texts.join(" ");
  if (/음식점|요리|맛집|핫도그|노점/.test(joined)) return "식당";
  if (/카페|제과점/.test(joined)) return "카페";
  if (/상점|쇼핑/.test(joined)) return "쇼핑";
  return "관광지";
}

function extractMemo(texts: string[]): string {
  let memo = "";
  for (let j = 2; j < texts.length; j++) {
    const t = texts[j];
    if (SKIP_PATTERNS.some((p) => p.test(t))) continue;
    if (KNOWN_CATEGORIES.includes(t)) continue;
    if (t.length > 5) memo = t;
  }
  return memo;
}

async function loadPuppeteer() {
  // Use dynamic require to avoid webpack bundling
  const modulePath = "/home/egkim/.npm/_npx/7d92d9a2d2ccc630/node_modules/puppeteer";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require(modulePath);
  return puppeteer.default || puppeteer;
}

interface PlaceItem {
  idx: number;
  texts: string[];
}

interface ExtractedPlace {
  name: string;
  lat: number | null;
  lng: number | null;
  google_maps_url: string;
  memo: string;
  category: string;
}

async function extractPlacesFromUrl(url: string): Promise<ExtractedPlace[]> {
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    // Navigate to list and scroll to load all items
    const gotoListAndScroll = async () => {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector(CONTAINER_SELECTOR, { timeout: 15000 });

      // Scroll to load all items
      for (let s = 0; s < 50; s++) {
        const changed = await page.evaluate((sel: string) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const before = el.scrollTop;
          el.scrollTop = el.scrollHeight;
          return el.scrollTop !== before;
        }, CONTAINER_SELECTOR);
        await new Promise((r) => setTimeout(r, 400));
        if (!changed) break;
      }
    };

    await gotoListAndScroll();

    // First pass: collect all items with text data
    const allItems: PlaceItem[] = await page.evaluate((sel: string) => {
      const container = document.querySelector(sel);
      if (!container) return [];
      const items: PlaceItem[] = [];
      for (let i = 0; i < container.children.length; i++) {
        const child = container.children[i];
        const tw = document.createTreeWalker(child, NodeFilter.SHOW_TEXT);
        let nd;
        const texts: string[] = [];
        while ((nd = tw.nextNode())) {
          const t = (nd as Text).textContent?.trim();
          if (t) texts.push(t);
        }
        // Items with a rating as second text (e.g. "4.5")
        if (texts.length >= 2 && /^\d\.\d$/.test(texts[1])) {
          items.push({ idx: i, texts });
        }
      }
      return items;
    }, CONTAINER_SELECTOR);

    if (allItems.length === 0) {
      throw new Error(
        "No places found in the list. The URL may not be a valid Google Maps list."
      );
    }

    const results: ExtractedPlace[] = [];

    for (const item of allItems) {
      // Navigate back to list each time
      await gotoListAndScroll();

      // Click the item
      const clicked = await page.evaluate(
        (sel: string, idx: number) => {
          const container = document.querySelector(sel);
          if (!container || !container.children[idx]) return false;
          const btn = container.children[idx].querySelector("button");
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        },
        CONTAINER_SELECTOR,
        item.idx
      );

      if (!clicked) continue;

      await new Promise((r) => setTimeout(r, 2500));
      const currentUrl = page.url();

      // Extract coordinates from URL
      const coordMatch = currentUrl.match(
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/
      );
      const lat = coordMatch ? parseFloat(coordMatch[1]) : null;
      const lng = coordMatch ? parseFloat(coordMatch[2]) : null;

      // Extract clean place URL
      const placeMatch = currentUrl.match(
        /(https:\/\/www\.google\.com\/maps\/place\/[^?]+)/
      );
      const google_maps_url = placeMatch
        ? placeMatch[1]
        : currentUrl.split("?")[0];

      const name = item.texts[0];
      const category = classifyCategory(item.texts);
      const memo = extractMemo(item.texts);

      results.push({ name, lat, lng, google_maps_url, memo, category });
    }

    return results;
  } finally {
    await browser.close();
  }
}

async function getExistingPlaces(): Promise<
  Set<string>
> {
  const { data, error } = await supabase
    .from("itinerary")
    .select("google_maps_url, spot_name, lat, lng")
    .eq("trip_id", 1);

  if (error) {
    console.error("Supabase query error:", error);
    return new Set();
  }

  const keys = new Set<string>();
  for (const row of data || []) {
    if (row.google_maps_url) {
      keys.add(`url:${row.google_maps_url}`);
    }
    if (row.spot_name && row.lat != null && row.lng != null) {
      keys.add(`name_coord:${row.spot_name}:${row.lat}:${row.lng}`);
    }
  }
  return keys;
}

function isDuplicate(
  place: ExtractedPlace,
  existingKeys: Set<string>
): boolean {
  if (place.google_maps_url && existingKeys.has(`url:${place.google_maps_url}`)) {
    return true;
  }
  if (
    place.name &&
    place.lat != null &&
    place.lng != null &&
    existingKeys.has(`name_coord:${place.name}:${place.lat}:${place.lng}`)
  ) {
    return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'url' parameter" },
        { status: 400 }
      );
    }

    // Validate it looks like a Google Maps URL
    if (
      !url.includes("google.com/maps") &&
      !url.includes("maps.app.goo.gl")
    ) {
      return NextResponse.json(
        { error: "URL does not appear to be a Google Maps link" },
        { status: 400 }
      );
    }

    // Extract places and check duplicates in parallel where possible
    const [places, existingKeys] = await Promise.all([
      extractPlacesFromUrl(url),
      getExistingPlaces(),
    ]);

    // Filter out duplicates
    const newPlaces = places.filter((p) => !isDuplicate(p, existingKeys));
    const duplicateCount = places.length - newPlaces.length;

    return NextResponse.json({
      total_found: places.length,
      duplicates_removed: duplicateCount,
      places: newPlaces,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("import-gmaps-list error:", message);
    return NextResponse.json(
      { error: `Failed to extract places: ${message}` },
      { status: 500 }
    );
  }
}
