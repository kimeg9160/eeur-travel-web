const puppeteer = require('puppeteer');

const LIST_URL = 'https://www.google.com/maps/@/data=!3m1!4b1!4m3!11m2!2sdPIbsI_avU1Kx0QlzaOYxgI0Xvbr0A!3e3?entry=tts';
const SELECTOR = '.m6QErb.DxyBCb.kA9KIf.dS8AEf';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  async function gotoList() {
    await page.goto(LIST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector(SELECTOR, { timeout: 10000 });
    // Scroll to load all items
    for (let s = 0; s < 30; s++) {
      const changed = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const before = el.scrollTop;
        el.scrollTop = el.scrollHeight;
        return el.scrollTop !== before;
      }, SELECTOR);
      await new Promise(r => setTimeout(r, 400));
      if (!changed) break;
    }
  }

  console.log('Navigating to list...');
  await gotoList();

  // First pass: collect all names and text data
  const allItems = await page.evaluate((sel) => {
    const container = document.querySelector(sel);
    const items = [];
    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i];
      const tw = document.createTreeWalker(child, NodeFilter.SHOW_TEXT);
      let nd;
      const texts = [];
      while (nd = tw.nextNode()) {
        const t = nd.textContent.trim();
        if (t) texts.push(t);
      }
      if (texts.length >= 2 && /^\d\.\d$/.test(texts[1])) {
        items.push({ idx: i, texts });
      }
    }
    return items;
  }, SELECTOR);

  console.log(`Found ${allItems.length} places`);

  const results = [];

  for (const item of allItems) {
    // Go to list and scroll
    await gotoList();

    // Click this item
    const clicked = await page.evaluate((sel, idx) => {
      const container = document.querySelector(sel);
      if (!container || !container.children[idx]) return false;
      const btn = container.children[idx].querySelector('button');
      if (btn) { btn.click(); return true; }
      return false;
    }, SELECTOR, item.idx);

    if (!clicked) {
      console.log(`  [${item.idx}] ${item.texts[0]} - could not click`);
      continue;
    }

    await new Promise(r => setTimeout(r, 2500));
    const url = page.url();

    // Extract coordinates
    const coordMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    const lat = coordMatch ? parseFloat(coordMatch[1]) : null;
    const lng = coordMatch ? parseFloat(coordMatch[2]) : null;

    // Clean place URL (remove query params for cleaner storage)
    const placeMatch = url.match(/(https:\/\/www\.google\.com\/maps\/place\/[^?]+)/);
    const google_maps_url = placeMatch ? placeMatch[1] : url.split('?')[0];

    // Parse item data
    const texts = item.texts;
    const name = texts[0];
    const rating = texts[1];

    // Determine category
    let category = '관광지';
    const joined = texts.join(' ');
    if (/음식점|요리|맛집|핫도그|노점/.test(joined)) category = '식당';
    else if (/카페|제과점/.test(joined)) category = '카페';
    else if (/상점|쇼핑/.test(joined)) category = '쇼핑';

    // Extract memo (longer user-written text)
    const skipPat = [/^\d\.\d$/, /^\([\d,]+\)$/, /^€/, /^₩/, /^·$/];
    const knownCats = ['박물관','정원','역사적 명소','대성당','요새','상점','관광 안내소','명승지','제과점','관광 명소','성곽','미술관','놀이공원','음식점','오스트리아 요리','핫도그 판매 노점','핫도그 판매대','산악 케이블카','천주교 성당','역사적 장소'];
    let memo = '';
    for (let j = 2; j < texts.length; j++) {
      const t = texts[j];
      if (skipPat.some(p => p.test(t))) continue;
      if (knownCats.includes(t)) continue;
      if (t.length > 5) memo = t;
    }

    results.push({ name, rating, lat, lng, google_maps_url, memo, category });
    console.log(`  [${item.idx}] ${name} -> ${lat}, ${lng}`);
  }

  await browser.close();

  const outputPath = '/home/egkim/Project/EEUR/Accommodation/web/scripts/gmaps-places.json';
  require('fs').writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nDone! ${results.length} places saved to ${outputPath}`);
})();
