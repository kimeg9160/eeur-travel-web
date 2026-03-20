"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, City } from "@/lib/types";

const CITY_SEARCH: Record<string, { en: string; ko: string }> = {
  "부다페스트":     { en: "Budapest, Hungary",     ko: "부다페스트" },
  "빈":             { en: "Vienna, Austria",        ko: "빈" },
  "잘츠부르크":     { en: "Salzburg, Austria",      ko: "잘츠부르크" },
  "체스키 크룸로프": { en: "Cesky Krumlov, Czech Republic", ko: "체스키 크룸로프" },
  "프라하":         { en: "Prague, Czech Republic",  ko: "프라하" },
};

const _CITY_SHORT: Record<string, string> = {
  "부다페스트": "BUD", "빈": "VIE", "할슈타트": "HAL",
  "잘츠부르크": "SZG", "체스키 크룸로프": "CK", "프라하": "PRG",
};
void _CITY_SHORT;

function calcNights(ci: string, co: string): number {
  const d1 = new Date(ci);
  const d2 = new Date(co);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

function buildOtaLinks(cityName: string, ci: string, co: string, adults: number) {
  const search = CITY_SEARCH[cityName] || { en: cityName, ko: cityName };
  const los = calcNights(ci, co);

  return [
    {
      name: "Booking",
      icon: "🏨",
      url: `https://www.booking.com/searchresults.ko.html?ss=${encodeURIComponent(search.en)}&checkin=${ci}&checkout=${co}&group_adults=${adults}&no_rooms=1&group_children=0`,
    },
    {
      name: "Agoda",
      icon: "🅰️",
      url: `https://www.agoda.com/ko-kr/search?textToSearch=${encodeURIComponent(search.en)}&checkIn=${ci}&los=${los}&rooms=1&adults=${adults}&children=0&currency=KRW&checkOut=${co}`,
    },
    {
      name: "Expedia",
      icon: "✈️",
      url: `https://www.expedia.co.kr/Hotel-Search?destination=${encodeURIComponent(search.en)}&startDate=${ci}&endDate=${co}&adults=${adults}&rooms=1`,
    },
    {
      name: "Hotels",
      icon: "🏠",
      url: `https://kr.hotels.com/Hotel-Search?destination=${encodeURIComponent(search.en)}&startDate=${ci}&endDate=${co}&adults=${adults}&rooms=1`,
    },
    {
      name: "Trip",
      icon: "🌏",
      url: `https://kr.trip.com/hotels/list?searchWord=${encodeURIComponent(search.ko)}&checkIn=${ci}&checkOut=${co}&adult=${adults}&children=0&crn=1&barCurr=KRW`,
    },
    {
      name: "Google",
      icon: "🔍",
      url: `https://www.google.com/travel/search?q=${encodeURIComponent(search.en + " hotels")}&qs=OAA&hl=ko&gl=kr&checkin=${ci}&checkout=${co}&guests=${adults}`,
    },
  ];
}

export default function SearchPage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [adults, setAdults] = useState(2);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, c] = await Promise.all([
        supabase.from("trips").select("*").eq("id", 1).single(),
        supabase.from("cities").select("*").eq("trip_id", 1).order("visit_order"),
      ]);
      if (t.data) setTrip(t.data);
      if (c.data) {
        setCities(c.data);
        const first = c.data.find((ct: City) => (ct.nights ?? 0) > 0);
        if (first) {
          setSelectedCity(first.name);
          setCheckin(first.checkin_date || "");
          setCheckout(first.checkout_date || "");
        }
      }
    })();
  }, []);

  useEffect(() => {
    const city = cities.find((c) => c.name === selectedCity);
    if (city) {
      setCheckin(city.checkin_date || "");
      setCheckout(city.checkout_date || "");
      setSearched(false);
    }
  }, [selectedCity, cities]);

  if (!trip) return <div className="text-slate-400 p-4 md:p-8">로딩 중...</div>;

  const citiesWithNights = cities.filter((c) => (c.nights ?? 0) > 0);
  const otaLinks = searched ? buildOtaLinks(selectedCity, checkin, checkout, adults) : [];

  async function addToCandidate(name: string) {
    const city = cities.find((c) => c.name === selectedCity);
    await supabase.from("accommodations").insert({
      trip_id: 1, city_id: city?.id || null, name, source: "manual", tag: "검색결과",
      star_rating: 0, review_score: 0, review_count: 0,
      price_per_night_eur: 0, price_per_night_krw: 0, is_booked: 0,
    });
    alert(`'${name}' 후보에 추가되었습니다!`);
  }

  return (
    <div>
      <h1 className="text-lg md:text-2xl font-bold text-slate-800 mb-4 md:mb-6">숙소 검색</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6 mb-4 md:mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-3 md:mb-4">
          <div>
            <label className="text-[10px] md:text-xs text-slate-500 block mb-1">도시</label>
            <select
              className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              {citiesWithNights.map((c) => (
                <option key={c.id} value={c.name}>{c.country_flag} {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] md:text-xs text-slate-500 block mb-1">체크인</label>
            <input type="date" className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={checkin} onChange={(e) => setCheckin(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] md:text-xs text-slate-500 block mb-1">체크아웃</label>
            <input type="date" className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={checkout} onChange={(e) => setCheckout(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] md:text-xs text-slate-500 block mb-1">성인</label>
            <input type="number" className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" min={1} max={10} value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
          </div>
        </div>
        <button
          onClick={() => setSearched(true)}
          className="bg-blue-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-lg font-medium hover:bg-blue-700 text-xs md:text-sm w-full md:w-auto"
        >
          검색 링크 생성
        </button>
      </div>

      {searched && (
        <div className="mb-6 md:mb-8">
          <h2 className="text-base md:text-lg font-bold text-slate-800 mb-1.5 md:mb-2">검색 링크</h2>
          <p className="text-[10px] md:text-sm text-slate-500 mb-3 md:mb-4">
            {selectedCity} · {checkin} ~ {checkout} ({calcNights(checkin, checkout)}박) · {adults}명
          </p>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {otaLinks.map((ota) => (
              <a
                key={ota.name}
                href={ota.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-xl border border-slate-200 p-3 md:p-5 text-center hover:border-blue-300 hover:bg-blue-50 transition-all hover:-translate-y-0.5"
              >
                <div className="text-lg md:text-2xl mb-0.5 md:mb-1">{ota.icon}</div>
                <div className="font-semibold text-blue-600 text-[11px] md:text-base">{ota.name}</div>
                <div className="text-[9px] md:text-xs text-slate-400 mt-0.5 md:mt-1 hidden md:block">{checkin} ~ {checkout}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
        <h2 className="text-base md:text-lg font-bold text-slate-800 mb-3 md:mb-4">수동 추가</h2>
        <p className="text-[10px] md:text-sm text-slate-500 mb-3 md:mb-4">OTA에서 찾은 숙소명을 입력해서 후보에 추가</p>
        <ManualAddForm onAdd={addToCandidate} />
      </div>
    </div>
  );
}

function ManualAddForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");

  return (
    <div className="flex gap-2 md:gap-3">
      <input
        className="flex-1 border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm"
        placeholder="숙소명"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onAdd(name.trim());
            setName("");
          }
        }}
      />
      <button
        onClick={() => { if (name.trim()) { onAdd(name.trim()); setName(""); } }}
        className="bg-blue-600 text-white px-3 md:px-5 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium hover:bg-blue-700 flex-shrink-0"
      >
        추가
      </button>
    </div>
  );
}
