"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, City, Accommodation } from "@/lib/types";

const CITY_SHORT: Record<string, string> = {
  "부다페스트": "BUD", "빈": "VIE", "할슈타트": "HAL",
  "잘츠부르크": "SZG", "린츠": "LNZ", "체스키 크룸로프": "CK", "프라하": "PRG",
};

function parseNote(note: string | null) {
  if (!note) return {};
  const result: Record<string, string> = {};
  const parts = note.split("|").map((s) => s.trim());
  for (const part of parts) {
    const m = part.match(/^(?:\[(\w+)\]\s*)?(.+?):\s*(.+)$/);
    if (m) {
      if (m[1] && !result["플랫폼"]) result["플랫폼"] = m[1];
      result[m[2].trim()] = m[3].trim();
    }
  }
  return result;
}

function googleMapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = weekdays[d.getDay()];
  return `${m}/${day}(${w})`;
}

const CHECKIN_TIMES: Record<string, string> = {
  "You Hotel Budapest - Handwritten Collection": "15:00",
  "Simm's Hotel - cityhotel next to Metro U3": "14:00",
  "Austria Trend Hotel Europa Salzburg": "14:00",
  "Leonardo Boutique Hotel Linz City Center": "15:00",
  "Hotel Dvorak Cesky Krumlov": "15:00",
  "Ibis Praha Old Town Hotel": "15:00",
};
const CHECKOUT_TIMES: Record<string, string> = {
  "You Hotel Budapest - Handwritten Collection": "11:00",
  "Simm's Hotel - cityhotel next to Metro U3": "11:00",
  "Austria Trend Hotel Europa Salzburg": "12:00",
  "Leonardo Boutique Hotel Linz City Center": "12:00",
  "Hotel Dvorak Cesky Krumlov": "11:00",
  "Ibis Praha Old Town Hotel": "12:00",
};

export default function AccommodationPage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [accs, setAccs] = useState<Accommodation[]>([]);
  const [selectedCity, setSelectedCity] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [t, c, a] = await Promise.all([
      supabase.from("trips").select("*").eq("id", 1).single(),
      supabase.from("cities").select("*").eq("trip_id", 1).order("visit_order"),
      supabase.from("accommodations").select("*").eq("trip_id", 1).order("checkin_date"),
    ]);
    if (t.data) setTrip(t.data);
    if (c.data) setCities(c.data);
    if (a.data) setAccs(a.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!trip) return <div className="text-slate-400 p-4 md:p-8">로딩 중...</div>;

  const citiesWithNights = cities.filter((c) => (c.nights ?? 0) > 0);
  const cityById = Object.fromEntries(cities.map((c) => [c.id, c]));
  const filtered = selectedCity ? accs.filter((a) => a.city_id === selectedCity) : accs;

  const totalKrw = accs.reduce((s, a) => s + (a.total_price_krw || 0), 0);
  const totalTax = accs.reduce((s, a) => {
    const info = parseNote(a.note);
    const tax = parseInt((info["현지세금"] || "0").replace(/[^\d]/g, "")) || 0;
    return s + tax;
  }, 0);

  return (
    <div>
      <h1 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 md:mb-2">확정 숙소</h1>
      <p className="text-xs md:text-sm text-slate-500 mb-3 md:mb-4">
        {accs.length}곳 · {accs.reduce((s, a) => s + (a.nights || 0), 0)}박 · 총 ₩{totalKrw.toLocaleString()}
        {totalTax > 0 && <span className="text-amber-600"> + 현지세금 ₩{totalTax.toLocaleString()}</span>}
      </p>

      {/* City filter */}
      <div className="flex gap-1.5 md:gap-2 mb-4 md:mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCity(null)}
          className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium flex-shrink-0 ${!selectedCity ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
        >
          전체
        </button>
        {citiesWithNights.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCity(c.id)}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium flex-shrink-0 ${selectedCity === c.id ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
          >
            <span className="md:hidden">{c.country_flag} {CITY_SHORT[c.name] || c.name}</span>
            <span className="hidden md:inline">{c.country_flag} {c.name}</span>
          </button>
        ))}
      </div>

      {/* Accommodation cards */}
      <div className="space-y-4 md:space-y-5">
        {filtered.map((acc) => {
          const city = cityById[acc.city_id ?? 0];
          const info = parseNote(acc.note);
          const tax = parseInt((info["현지세금"] || "0").replace(/[^\d]/g, "")) || 0;
          const checkinTime = CHECKIN_TIMES[acc.name] || "15:00";
          const checkoutTime = CHECKOUT_TIMES[acc.name] || "11:00";

          return (
            <div key={acc.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base md:text-lg">{city?.country_flag}</span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 text-sm md:text-base leading-tight">{acc.name}</h3>
                      <p className="text-[11px] md:text-xs text-slate-500 mt-0.5">
                        {city?.name} · {acc.nights}박
                        {acc.breakfast_included ? " · 조식포함" : ""}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${
                    acc.source === "NOL" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                  }`}>
                    {acc.source || ""}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="px-4 py-3">
                {/* Check-in / Check-out */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-[10px] md:text-xs text-slate-400 mb-0.5">체크인</p>
                    <p className="text-sm md:text-base font-semibold text-slate-800">
                      {formatDate(acc.checkin_date)}
                    </p>
                    <p className="text-xs md:text-sm text-blue-600 font-medium">{checkinTime} 이후</p>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs text-slate-400 mb-0.5">체크아웃</p>
                    <p className="text-sm md:text-base font-semibold text-slate-800">
                      {formatDate(acc.checkout_date)}
                    </p>
                    <p className="text-xs md:text-sm text-red-500 font-medium">{checkoutTime} 이전</p>
                  </div>
                </div>

                {/* Booking numbers */}
                <div className="bg-slate-50 rounded-lg p-2.5 md:p-3 mb-3 space-y-1.5">
                  {info["예약번호"] && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] md:text-xs text-slate-500">예약번호</span>
                      <span className="text-xs md:text-sm font-mono font-medium text-slate-800">{info["예약번호"]}</span>
                    </div>
                  )}
                  {info["체크인번호"] && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] md:text-xs text-slate-500">체크인번호</span>
                      <span className="text-xs md:text-sm font-mono font-medium text-slate-800">{info["체크인번호"]}</span>
                    </div>
                  )}
                </div>

                {/* Price */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[10px] md:text-xs text-slate-400">결제금액</span>
                    <p className="text-lg md:text-xl font-bold text-slate-800">₩{(acc.total_price_krw || 0).toLocaleString()}</p>
                  </div>
                  {tax > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] md:text-xs text-slate-400">현지세금</span>
                      <p className="text-sm md:text-base font-semibold text-amber-600">+ ₩{tax.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {/* Cancellation */}
                {acc.cancellation_policy && (
                  <p className="text-[10px] md:text-xs text-slate-500 mb-3">
                    <span className="text-slate-400">취소: </span>{acc.cancellation_policy}
                  </p>
                )}

                {/* Address + Google Maps button */}
                {acc.address && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <p className="text-[10px] md:text-xs text-slate-500 flex-1 min-w-0">{acc.address}</p>
                    <a
                      href={acc.booking_url || googleMapsUrl(acc.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 bg-blue-600 text-white text-[10px] md:text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      Google Maps
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
