"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, City, ItineraryItem, Accommodation, Transfer } from "@/lib/types";
import dynamic from "next/dynamic";

const GoogleMapView = dynamic(() => import("@/components/GoogleMapView"), { ssr: false });
const AddScheduleModal = dynamic(() => import("@/components/AddScheduleModal"), { ssr: false });

const CAT_EMOJI: Record<string, string> = {
  "관광지": "🏛️", "식당": "🍽️", "카페": "☕", "쇼핑": "🛍️", "숙소": "🏨", "이동": "🚌",
};
const CAT_COLOR: Record<string, string> = {
  "관광지": "#3b82f6", "식당": "#ef4444", "카페": "#f59e0b", "쇼핑": "#ec4899", "숙소": "#10b981", "이동": "#6b7280",
};

const COUNTRY_FLAGS: Record<string, string> = {
  "헝가리": "🇭🇺", "오스트리아": "🇦🇹", "체코": "🇨🇿",
};
const COUNTRY_SHORT: Record<string, string> = {
  "헝가리": "HU", "오스트리아": "AT", "체코": "CZ",
};

const CITY_LANDMARKS: Record<string, { name: string; position: [number, number]; type: "train" | "bus" }[]> = {
  "Budapest": [
    { name: "Keleti 역", position: [47.5003, 19.0839], type: "train" },
    { name: "Nyugati 역", position: [47.5098, 19.0556], type: "train" },
    { name: "Déli 역", position: [47.4971, 19.0256], type: "train" },
    { name: "Népliget 버스터미널", position: [47.4764, 19.0894], type: "bus" },
    { name: "Keleti (Thököly út)", position: [47.5010, 19.0850], type: "bus" },
    { name: "Mexikói út (M1)", position: [47.5175, 19.0985], type: "bus" },
  ],
  "Vienna": [
    { name: "Wien Hbf", position: [48.1853, 16.3764], type: "train" },
    { name: "Westbahnhof", position: [48.1969, 16.3389], type: "train" },
    { name: "VIB Erdberg (FlixBus)", position: [48.1915, 16.4043], type: "bus" },
  ],
  "Hallstatt": [
    { name: "Hallstatt Bhf", position: [47.5615, 13.6467], type: "train" },
  ],
  "Salzburg": [
    { name: "Salzburg Hbf", position: [47.8131, 13.0459], type: "train" },
    { name: "Salzburg Hbf (FlixBus)", position: [47.8120, 13.0440], type: "bus" },
  ],
  "Český Krumlov": [
    { name: "CK 버스터미널", position: [48.8106, 14.3146], type: "bus" },
  ],
  "Linz": [
    { name: "Linz Hbf", position: [48.2904, 14.2918], type: "train" },
  ],
  "Prague": [
    { name: "Praha hl.n.", position: [50.0833, 14.4347], type: "train" },
    { name: "Florenc (FlixBus)", position: [50.0900, 14.4400], type: "bus" },
  ],
};

/* ── CSV/JSON Import helpers ── */
function downloadTemplate() {
  const header = "day_number,spot_name,time,category,memo,cost_krw,cost_eur,latitude,longitude,google_maps_url";
  const example = '3,성 비투스 대성당,09:00,관광지,프라하성 내부,0,0,50.0908,14.4006,https://maps.app.goo.gl/xxx';
  const csv = `${header}\n${example}\n`;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "schedule_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): Partial<ItineraryItem>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return {
      day_number: parseInt(obj.day_number) || 1,
      spot_name: obj.spot_name || "",
      time: obj.time || null,
      category: obj.category || "관광지",
      memo: obj.memo || null,
      cost_krw: parseFloat(obj.cost_krw) || 0,
      cost_eur: parseFloat(obj.cost_eur) || 0,
      latitude: obj.latitude ? parseFloat(obj.latitude) : null,
      longitude: obj.longitude ? parseFloat(obj.longitude) : null,
      google_maps_url: obj.google_maps_url || null,
    };
  }).filter((i) => i.spot_name);
}

function parseJsonImport(text: string): Partial<ItineraryItem>[] {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((d) => ({
    day_number: d.day_number || 1,
    spot_name: d.spot_name || "",
    time: d.time || null,
    category: d.category || "관광지",
    memo: d.memo || null,
    cost_krw: d.cost_krw || 0,
    cost_eur: d.cost_eur || 0,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    google_maps_url: d.google_maps_url || null,
  })).filter((i) => i.spot_name);
}

/* ── Normalize legacy categories ── */
function normalizeCategory(cat: string | null): string | null {
  if (cat === "바/펍") return "카페";
  return cat;
}

export default function SchedulePage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [accs, setAccs] = useState<Accommodation[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const [t, c, i, a, tr] = await Promise.all([
      supabase.from("trips").select("*").eq("id", 1).single(),
      supabase.from("cities").select("*").eq("trip_id", 1).order("visit_order"),
      supabase.from("itinerary").select("*").eq("trip_id", 1).order("day_number").order("time"),
      supabase.from("accommodations").select("*").eq("trip_id", 1).order("checkin_date"),
      supabase.from("transfers").select("*").eq("trip_id", 1).order("date"),
    ]);
    if (t.data) setTrip(t.data);
    if (c.data) setCities(c.data);
    if (i.data) setItems(i.data.map((item) => ({ ...item, category: normalizeCategory(item.category) })));
    if (a.data) setAccs(a.data);
    if (tr.data) setTransfers(tr.data);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveItem = useCallback(async (item: Partial<ItineraryItem>) => {
    const { error } = await supabase.from("itinerary").insert(item);
    if (error) {
      alert("저장 실패: " + error.message);
      throw error;
    }
    await loadData();
  }, [loadData]);

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      let parsed: Partial<ItineraryItem>[];
      if (file.name.endsWith(".json")) {
        parsed = parseJsonImport(text);
      } else {
        parsed = parseCsv(text);
      }
      if (parsed.length === 0) {
        alert("파싱된 항목이 없습니다.");
        return;
      }
      const dayToCityId: Record<number, number | null> = {};
      items.forEach((item) => {
        if (!dayToCityId[item.day_number] && item.city_id) {
          dayToCityId[item.day_number] = item.city_id;
        }
      });

      const toInsert = parsed.map((p) => ({
        ...p,
        trip_id: 1,
        city_id: p.city_id ?? dayToCityId[p.day_number!] ?? null,
      }));

      const { error } = await supabase.from("itinerary").insert(toInsert);
      if (error) {
        alert("Import 실패: " + error.message);
      } else {
        alert(`${toInsert.length}건 추가 완료`);
        await loadData();
      }
    } catch (err) {
      alert("파일 파싱 오류: " + (err as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [items, loadData]);

  if (!trip || !items.length) return <div className="text-slate-400 p-4 md:p-8">로딩 중...</div>;

  // Build regions dynamically from cities.country
  const regionCountries = Array.from(new Set(cities.map((c) => c.country).filter(Boolean))) as string[];

  const dayNumbers = Array.from(new Set(items.map((i) => i.day_number))).sort((a, b) => a - b);
  const cityById = Object.fromEntries(cities.map((c) => [c.id, c]));
  // cityNameEnMap: 한글 도시명 → 영문 (DB에서)
  const cityNameEnMap = Object.fromEntries(cities.filter((c) => c.name_en).map((c) => [c.name, c.name_en!]));

  // Determine what to show based on region or day selection
  const isRegionMode = !!selectedRegion;
  let displayItems: ItineraryItem[];
  let displayAccs: Accommodation[];
  let mapLandmarkKeys: string[];

  if (isRegionMode) {
    const regionCityIds = cities
      .filter((c) => c.country === selectedRegion)
      .map((c) => c.id);
    displayItems = items.filter((i) => i.city_id && regionCityIds.includes(i.city_id));
    displayAccs = accs.filter((a) => a.city_id && regionCityIds.includes(a.city_id));
    mapLandmarkKeys = cities
      .filter((c) => c.country === selectedRegion && c.name_en)
      .map((c) => c.name_en!);
  } else {
    displayItems = items.filter((i) => i.day_number === selectedDay);
    const startDate = new Date(trip.start_date);
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + selectedDay - 1);
    const dateStr = dayDate.toISOString().split("T")[0];
    displayAccs = accs.filter((a) => {
      if (!a.checkin_date || !a.checkout_date) return false;
      return dateStr >= a.checkin_date && dateStr < a.checkout_date;
    });
    const city = displayItems[0]?.city_id ? cityById[displayItems[0].city_id] : null;
    const cityEn = city?.name_en || cityNameEnMap[city?.name || ""] || "";
    mapLandmarkKeys = cityEn ? [cityEn] : [];
  }

  // Day header info
  const startDate = new Date(trip.start_date);
  const dayDate = new Date(startDate);
  dayDate.setDate(dayDate.getDate() + selectedDay - 1);
  const dateStr = dayDate.toISOString().split("T")[0];
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const dayOfWeek = weekdays[dayDate.getDay()];
  const dayCity = displayItems[0]?.city_id ? cityById[displayItems[0].city_id] : null;

  const itineraryMarkers = displayItems
    .filter((i) => i.latitude && i.longitude)
    .map((i, idx) => ({
      position: [i.latitude!, i.longitude!] as [number, number],
      label: i.spot_name,
      popup: `<strong>${idx + 1}. ${i.spot_name}</strong><br/>${i.category || ""}${i.time ? " · " + i.time : ""}${isRegionMode ? `<br/>Day ${i.day_number}` : ""}`,
      color: CAT_COLOR[i.category || ""] || "#3b82f6",
    }));

  const accMarkers = displayAccs
    .filter((a) => a.latitude && a.longitude)
    .map((a) => ({
      position: [a.latitude!, a.longitude!] as [number, number],
      label: a.name,
      popup: `<strong>🏨 ${a.name}</strong><br/>숙소`,
      color: CAT_COLOR["숙소"],
    }));

  // Google Maps URL: google_maps_url 우선 → 좌표 fallback → 이름 검색
  const gmapsUrl = (name: string, googleMapsUrl?: string | null, lat?: number | null, lng?: number | null) => {
    if (googleMapsUrl) return googleMapsUrl;
    if (lat && lng) return `https://www.google.com/maps?q=${lat},${lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  };

  // 해당 날짜의 교통편 매칭
  const TRANSPORT_EMOJI: Record<string, string> = {
    "버스": "🚌", "기차": "🚂", "비행기": "✈️", "기타": "🎫",
  };
  const formatDuration = (min: string | null) => {
    const m = parseInt(min || "0");
    if (!m) return "";
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h === 0) return `${r}분`;
    if (r === 0) return `${h}시간`;
    return `${h}시간 ${r}분`;
  };
  const displayTransfers = isRegionMode
    ? transfers.filter((t) => {
        const regionCityIds = cities.filter((c) => c.country === selectedRegion).map((c) => c.id);
        return (t.from_city_id && regionCityIds.includes(t.from_city_id)) ||
               (t.to_city_id && regionCityIds.includes(t.to_city_id));
      })
    : transfers.filter((t) => {
        // 날짜가 명시된 교통편
        if (t.date === dateStr) return true;
        // 도시 checkout 날짜 기반 매칭 (이동일)
        if (!t.date && t.from_city_id) {
          const fromCity = cityById[t.from_city_id];
          if (fromCity?.checkout_date === dateStr) return true;
        }
        return false;
      });

  const landmarkMarkers = mapLandmarkKeys.flatMap((key) =>
    (CITY_LANDMARKS[key] || []).map((lm) => ({
      position: lm.position,
      label: lm.name,
      popup: `<strong>${lm.type === "train" ? "🚂" : "🚌"} ${lm.name}</strong>`,
      color: lm.type === "train" ? "#0d9488" : "#d97706",
      shape: "square" as const,
    }))
  );

  const markers = [...itineraryMarkers, ...accMarkers, ...landmarkMarkers];
  const allPositions = markers.map((m) => m.position);
  const useBounds = allPositions.length >= 2;

  const center = markers.length
    ? [
        markers.reduce((s, m) => s + m.position[0], 0) / markers.length,
        markers.reduce((s, m) => s + m.position[1], 0) / markers.length,
      ] as [number, number]
    : [48.5, 15.0] as [number, number];

  // Group display items by day (for region mode)
  const itemsByDay: Record<number, ItineraryItem[]> = {};
  if (isRegionMode) {
    displayItems.forEach((item) => {
      if (!itemsByDay[item.day_number]) itemsByDay[item.day_number] = [];
      itemsByDay[item.day_number].push(item);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h1 className="text-lg md:text-2xl font-bold text-slate-800">일정</h1>
        <div className="flex gap-1.5">
          <button
            onClick={downloadTemplate}
            className="px-2.5 py-1.5 text-[11px] md:text-xs bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
          >
            CSV 템플릿
          </button>
          <label className={`px-2.5 py-1.5 text-[11px] md:text-xs bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer ${importing ? "opacity-50" : ""}`}>
            {importing ? "가져오는 중..." : "Import"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileImport}
              className="hidden"
              disabled={importing}
            />
          </label>
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-2.5 py-1.5 text-[11px] md:text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 추가
          </button>
        </div>
      </div>

      {/* Day tabs */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-2">
        {dayNumbers.map((d) => (
          <button
            key={d}
            onClick={() => { setSelectedDay(d); setSelectedRegion(null); }}
            className={`px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-colors ${
              selectedDay === d && !isRegionMode
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            D{d}
          </button>
        ))}
      </div>

      {/* Region tabs (dynamic from cities.country) */}
      <div className="flex gap-1 mb-4 md:mb-6">
        {regionCountries.map((country) => (
          <button
            key={country}
            onClick={() => setSelectedRegion(selectedRegion === country ? null : country)}
            className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg text-[11px] md:text-xs font-medium transition-colors ${
              selectedRegion === country
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span className="md:hidden">{COUNTRY_SHORT[country] || country}</span>
            <span className="hidden md:inline">{COUNTRY_FLAGS[country] || ""} {country}</span>
          </button>
        ))}
        {isRegionMode && (
          <span className="flex items-center text-[10px] md:text-xs text-slate-400 ml-2">
            {itineraryMarkers.length}곳
          </span>
        )}
      </div>

      {/* Header */}
      <div className="mb-3 md:mb-4">
        {isRegionMode ? (
          <h2 className="text-base md:text-xl font-bold text-slate-800">
            {COUNTRY_FLAGS[selectedRegion!] || ""} {selectedRegion}
          </h2>
        ) : (
          <h2 className="text-base md:text-xl font-bold text-slate-800">
            {dayCity?.country_flag} {dayCity?.name || ""} · {dateStr} ({dayOfWeek})
          </h2>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col md:grid md:grid-cols-5 gap-4 md:gap-6">
        {/* Map */}
        <div className="md:col-span-2 md:order-2">
          <GoogleMapView
            center={center}
            zoom={14}
            markers={markers}
            height="280px"
            showMyLocation
            bounds={useBounds ? allPositions : undefined}
          />
          {landmarkMarkers.length > 0 && (
            <div className="flex gap-3 mt-1.5 text-[10px] md:text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#0d9488" }} /> 기차역
              </span>
              <span className="flex items-center gap-1">
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#d97706" }} /> 버스
              </span>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="md:col-span-3 md:order-1 space-y-1">
          {isRegionMode ? (
            /* Region mode: group by day */
            Object.entries(itemsByDay)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([day, dayItems]) => {
                const dayCityObj = dayItems[0]?.city_id ? cityById[dayItems[0].city_id] : null;
                return (
                  <div key={day}>
                    <div className="text-xs font-semibold text-slate-500 mt-3 mb-1 first:mt-0">
                      Day {day} · {dayCityObj?.country_flag} {dayCityObj?.name || ""}
                    </div>
                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-2.5 md:gap-4 bg-white rounded-xl p-3 md:p-4 border border-slate-200 hover:border-slate-300 transition-colors mb-1"
                      >
                        <div className="text-lg md:text-2xl">{CAT_EMOJI[item.category || ""] || "📍"}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-800 text-sm md:text-base">{item.spot_name}</div>
                          <div className="text-[10px] md:text-xs text-slate-500 mt-0.5">
                            {item.category || ""}
                            {item.time ? ` · ${item.time}` : ""}
                          </div>
                          {item.memo && <div className="text-[10px] md:text-xs text-slate-400 mt-0.5 line-clamp-2">{item.memo}</div>}
                        </div>
                        {item.cost_krw > 0 && (
                          <div className="text-xs md:text-sm font-semibold text-blue-600 whitespace-nowrap">
                            ₩{item.cost_krw.toLocaleString()}
                          </div>
                        )}
                        <a
                          href={gmapsUrl(item.spot_name, item.google_maps_url, item.latitude, item.longitude)}
                          target={typeof window !== "undefined" && /Mobi|Android/i.test(navigator.userAgent) ? "_self" : "_blank"}
                          rel="noopener noreferrer"
                          className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 transition-colors"
                          title="Google Maps에서 보기"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                        </a>
                      </div>
                    ))}
                  </div>
                );
              })
          ) : (
            /* Day mode */
            <>
              {/* Accommodation */}
              {displayAccs.map((acc) => {
                const isCheckin = acc.checkin_date === dateStr;
                return (
                  <div
                    key={`acc-${acc.id}`}
                    className="flex items-start gap-2.5 md:gap-4 bg-emerald-50 rounded-xl p-3 md:p-4 border border-emerald-200"
                  >
                    <div className="text-lg md:text-2xl">🏨</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 text-sm md:text-base">{acc.name}</div>
                      <div className="text-[10px] md:text-xs text-slate-500 mt-0.5">
                        숙소
                        {isCheckin && ` · 체크인 ${acc.checkin_time || "15:00"} 이후`}
                        {acc.nights && ` · ${acc.nights}박`}
                      </div>
                      {acc.address && (
                        <div className="text-[10px] md:text-xs text-slate-400 mt-0.5 line-clamp-1">{acc.address}</div>
                      )}
                    </div>
                    {acc.price_per_night_krw && acc.price_per_night_krw > 0 && (
                      <div className="text-xs md:text-sm font-semibold text-emerald-600 whitespace-nowrap">
                        ₩{acc.price_per_night_krw.toLocaleString()}/박
                      </div>
                    )}
                    <a
                      href={acc.booking_url || gmapsUrl(acc.name, null, acc.latitude, acc.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg bg-emerald-100 hover:bg-blue-100 text-emerald-500 hover:text-blue-600 transition-colors"
                      title="Google Maps에서 보기"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    </a>
                  </div>
                );
              })}

              {/* Transfers */}
              {displayTransfers.map((t) => {
                const fromCity = t.from_city_id ? cityById[t.from_city_id] : null;
                const toCity = t.to_city_id ? cityById[t.to_city_id] : null;
                const emoji = TRANSPORT_EMOJI[t.transport_type || ""] || "🚗";
                return (
                  <div
                    key={`transfer-${t.id}`}
                    className="flex items-start gap-2.5 md:gap-4 bg-amber-50 rounded-xl p-3 md:p-4 border border-amber-200"
                  >
                    <div className="text-lg md:text-2xl">{emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 text-sm md:text-base">
                        {fromCity?.country_flag || "🇰🇷"} {fromCity?.name || "서울"} → {toCity?.country_flag || "🇰🇷"} {toCity?.name || "서울"}
                      </div>
                      <div className="text-[10px] md:text-xs text-slate-500 mt-0.5">
                        {t.operator || ""}{t.duration ? ` · ${formatDuration(t.duration)}` : ""}
                        {t.is_booked ? "" : " · ⏳ 미예약"}
                      </div>
                      {t.note && <div className="text-[10px] md:text-xs text-slate-400 mt-0.5 line-clamp-2">{t.note}</div>}
                    </div>
                    {t.cost_krw > 0 && (
                      <div className="text-xs md:text-sm font-semibold text-amber-600 whitespace-nowrap">
                        ₩{t.cost_krw.toLocaleString()}
                      </div>
                    )}
                    {fromCity && toCity && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromCity.name)}&destination=${encodeURIComponent(toCity.name)}&travelmode=transit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg bg-amber-100 hover:bg-blue-100 text-amber-500 hover:text-blue-600 transition-colors"
                        title="Google Maps 경로"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      </a>
                    )}
                  </div>
                );
              })}

              {/* Itinerary */}
              {displayItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 md:gap-4 bg-white rounded-xl p-3 md:p-4 border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="text-lg md:text-2xl">{CAT_EMOJI[item.category || ""] || "📍"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm md:text-base">{item.spot_name}</div>
                    <div className="text-[10px] md:text-xs text-slate-500 mt-0.5">
                      {item.category || ""}
                      {item.time ? ` · ${item.time}` : ""}
                    </div>
                    {item.memo && <div className="text-[10px] md:text-xs text-slate-400 mt-0.5 line-clamp-2">{item.memo}</div>}
                  </div>
                  {item.cost_krw > 0 && (
                    <div className="text-xs md:text-sm font-semibold text-blue-600 whitespace-nowrap">
                      ₩{item.cost_krw.toLocaleString()}
                    </div>
                  )}
                  <a
                    href={gmapsUrl(item.spot_name, item.google_maps_url, item.latitude, item.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 transition-colors"
                    title="Google Maps에서 보기"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  </a>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Add schedule modal */}
      <AddScheduleModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleSaveItem}
        tripId={1}
        dayNumber={selectedDay}
        cityId={displayItems[0]?.city_id ?? null}
        defaultCenter={center}
      />
    </div>
  );
}
