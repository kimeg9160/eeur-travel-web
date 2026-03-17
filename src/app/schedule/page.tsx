"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, City, ItineraryItem } from "@/lib/types";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const CAT_EMOJI: Record<string, string> = {
  "관광지": "🏛️", "식당": "🍽️", "카페": "☕", "바/펍": "🍺", "쇼핑": "🛍️", "이동": "🚌",
};
const CAT_COLOR: Record<string, string> = {
  "관광지": "#3b82f6", "식당": "#ef4444", "카페": "#f59e0b", "바/펍": "#8b5cf6", "쇼핑": "#ec4899", "이동": "#6b7280",
};

const REGIONS = [
  { id: "hungary", label: "🇭🇺 헝가리", cityNames: ["부다페스트"] },
  { id: "austria", label: "🇦🇹 오스트리아", cityNames: ["빈", "할슈타트", "잘츠부르크"] },
  { id: "czech", label: "🇨🇿 체코", cityNames: ["체스키 크룸로프", "프라하"] },
];

// 각 도시의 주요 기차역 & FlixBus 정류장
const CITY_LANDMARKS: Record<string, { name: string; position: [number, number]; type: "train" | "bus" }[]> = {
  "Budapest": [
    { name: "Keleti 역 (동역)", position: [47.5003, 19.0839], type: "train" },
    { name: "Nyugati 역 (서역)", position: [47.5098, 19.0556], type: "train" },
    { name: "Déli 역 (남역)", position: [47.4971, 19.0256], type: "train" },
    { name: "Népliget 버스터미널 (FlixBus·시외버스, M3)", position: [47.4764, 19.0894], type: "bus" },
    { name: "Budapest Keleti (Thököly út)", position: [47.5010, 19.0850], type: "bus" },
    { name: "Budapest Mexikói út (M1 종점)", position: [47.5175, 19.0985], type: "bus" },
  ],
  "Vienna": [
    { name: "Wien Hbf (중앙역)", position: [48.1853, 16.3764], type: "train" },
    { name: "Wien Westbahnhof (서역)", position: [48.1969, 16.3389], type: "train" },
    { name: "VIB Erdberg (FlixBus)", position: [48.1915, 16.4043], type: "bus" },
  ],
  "Hallstatt": [
    { name: "Hallstatt Bahnhof", position: [47.5615, 13.6467], type: "train" },
  ],
  "Salzburg": [
    { name: "Salzburg Hbf (중앙역)", position: [47.8131, 13.0459], type: "train" },
    { name: "Salzburg Hbf 앞 (FlixBus)", position: [47.8120, 13.0440], type: "bus" },
  ],
  "Český Krumlov": [
    { name: "Český Krumlov 버스터미널", position: [48.8106, 14.3146], type: "bus" },
  ],
  "Prague": [
    { name: "Praha hl.n. (중앙역)", position: [50.0833, 14.4347], type: "train" },
    { name: "Florenc 버스터미널 (FlixBus)", position: [50.0900, 14.4400], type: "bus" },
  ],
};

const CITY_NAME_MAP: Record<string, string> = {
  "부다페스트": "Budapest", "빈": "Vienna", "할슈타트": "Hallstatt",
  "잘츠부르크": "Salzburg", "체스키 크룸로프": "Český Krumlov", "프라하": "Prague",
};

export default function SchedulePage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [t, c, i] = await Promise.all([
        supabase.from("trips").select("*").eq("id", 1).single(),
        supabase.from("cities").select("*").eq("trip_id", 1).order("visit_order"),
        supabase.from("itinerary").select("*").eq("trip_id", 1).order("day_number").order("time"),
      ]);
      if (t.data) setTrip(t.data);
      if (c.data) setCities(c.data);
      if (i.data) setItems(i.data);
    })();
  }, []);

  if (!trip || !items.length) return <div className="text-slate-400 p-8">로딩 중...</div>;

  const dayNumbers = Array.from(new Set(items.map((i) => i.day_number))).sort((a, b) => a - b);
  const dayItems = items.filter((i) => i.day_number === selectedDay);
  const cityById = Object.fromEntries(cities.map((c) => [c.id, c]));
  const city = dayItems[0]?.city_id ? cityById[dayItems[0].city_id] : null;

  const startDate = new Date(trip.start_date);
  const dayDate = new Date(startDate);
  dayDate.setDate(dayDate.getDate() + selectedDay - 1);
  const dateStr = dayDate.toISOString().split("T")[0];
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const dayOfWeek = weekdays[dayDate.getDay()];

  // --- 지도 마커 결정 ---
  const region = REGIONS.find((r) => r.id === selectedRegion);
  let mapItems: ItineraryItem[];
  let mapLandmarkKeys: string[];

  if (region) {
    const regionCityIds = cities
      .filter((c) => region.cityNames.includes(c.name))
      .map((c) => c.id);
    mapItems = items.filter((i) => i.city_id && regionCityIds.includes(i.city_id));
    mapLandmarkKeys = region.cityNames.map((n) => CITY_NAME_MAP[n] || "").filter(Boolean);
  } else {
    mapItems = dayItems;
    const cityName = city?.name || "";
    mapLandmarkKeys = [CITY_NAME_MAP[cityName] || ""].filter(Boolean);
  }

  const itineraryMarkers = mapItems
    .filter((i) => i.latitude && i.longitude)
    .map((i, idx) => ({
      position: [i.latitude!, i.longitude!] as [number, number],
      label: i.spot_name,
      popup: `<strong>${idx + 1}. ${i.spot_name}</strong><br/>${i.category || ""}${i.time ? " · " + i.time : ""}${region ? `<br/>Day ${i.day_number}` : ""}`,
      color: CAT_COLOR[i.category || ""] || "#3b82f6",
    }));

  const landmarkMarkers = mapLandmarkKeys.flatMap((key) =>
    (CITY_LANDMARKS[key] || []).map((lm) => ({
      position: lm.position,
      label: lm.name,
      popup: `<strong>${lm.type === "train" ? "🚂" : "🚌"} ${lm.name}</strong>`,
      color: lm.type === "train" ? "#0d9488" : "#d97706",
      shape: "square" as const,
    }))
  );

  const markers = [...itineraryMarkers, ...landmarkMarkers];

  // bounds: 마커 전체 좌표 → fitBounds 용
  const allPositions = markers.map((m) => m.position);
  const useBounds = allPositions.length >= 2;

  const center = markers.length
    ? [
        markers.reduce((s, m) => s + m.position[0], 0) / markers.length,
        markers.reduce((s, m) => s + m.position[1], 0) / markers.length,
      ] as [number, number]
    : [48.5, 15.0] as [number, number];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">📅 일정</h1>

      {/* Day tabs */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-2">
        {dayNumbers.map((d) => (
          <button
            key={d}
            onClick={() => { setSelectedDay(d); setSelectedRegion(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedDay === d && !selectedRegion
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Day {d}
          </button>
        ))}
      </div>

      {/* Region tabs */}
      <div className="flex gap-1 mb-6">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedRegion(selectedRegion === r.id ? null : r.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedRegion === r.id
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {r.label}
          </button>
        ))}
        {selectedRegion && (
          <span className="flex items-center text-xs text-slate-400 ml-2">
            📍 {region?.label} 전체 ({itineraryMarkers.length}곳)
          </span>
        )}
      </div>

      {/* Day header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">
          {city?.country_flag} {city?.name || ""} · {dateStr} ({dayOfWeek})
        </h2>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Timeline */}
        <div className="col-span-3 space-y-1">
          {dayItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors"
            >
              <div className="text-2xl">{CAT_EMOJI[item.category || ""] || "📍"}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800">{item.spot_name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {item.category || ""}
                  {item.time ? ` · ${item.time}` : ""}
                  {item.duration ? ` · ${item.duration}` : ""}
                </div>
                {item.memo && <div className="text-xs text-slate-400 mt-1">{item.memo}</div>}
              </div>
              {item.cost_krw > 0 && (
                <div className="text-sm font-semibold text-blue-600 whitespace-nowrap">
                  ₩{item.cost_krw.toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="col-span-2">
          <MapView
            center={center}
            zoom={14}
            markers={markers}
            height="500px"
            showMyLocation
            bounds={useBounds ? allPositions : undefined}
          />
          {landmarkMarkers.length > 0 && (
            <div className="flex gap-4 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#0d9488" }} /> 기차역
              </span>
              <span className="flex items-center gap-1">
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#d97706" }} /> 버스터미널
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
