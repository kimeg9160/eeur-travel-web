"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, City, Accommodation } from "@/lib/types";

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

function getPdfUrl(info: Record<string, string>) {
  const bookingId = info["예약번호"];
  if (!bookingId) return null;
  const platform = info["플랫폼"];
  if (platform === "NOL") return `/pdfs/booking_voucher_${bookingId}.pdf`;
  if (platform === "Agoda") return `/pdfs/Confirmation_for_Booking_ID_%23_${bookingId}.pdf`;
  return null;
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

  if (!trip) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">확정 숙소</h1>
        <p className="text-xs md:text-sm text-slate-400 mt-1">
          {accs.length}곳 · {accs.reduce((s, a) => s + (a.nights || 0), 0)}박 · 총 ₩{totalKrw.toLocaleString()}
          {totalTax > 0 && <span className="text-amber-500"> + 현지세금 ₩{totalTax.toLocaleString()}</span>}
        </p>
      </div>

      {/* City filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCity(null)}
          className={`px-4 py-2 rounded-xl text-xs md:text-sm font-medium flex-shrink-0 transition-all ${
            !selectedCity
              ? "bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md shadow-indigo-500/20"
              : "bg-white text-slate-500 shadow-sm hover:shadow-md"
          }`}
        >
          전체
        </button>
        {citiesWithNights.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCity(c.id)}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-medium flex-shrink-0 transition-all ${
              selectedCity === c.id
                ? "bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md shadow-indigo-500/20"
                : "bg-white text-slate-500 shadow-sm hover:shadow-md"
            }`}
          >
            <span className="md:hidden">{c.country_flag} {c.short_code || c.name}</span>
            <span className="hidden md:inline">{c.country_flag} {c.name}</span>
          </button>
        ))}
      </div>

      {/* Accommodation cards */}
      <div className="space-y-4">
        {filtered.map((acc) => {
          const city = cityById[acc.city_id ?? 0];
          const info = parseNote(acc.note);
          const tax = parseInt((info["현지세금"] || "0").replace(/[^\d]/g, "")) || 0;
          const checkinTime = acc.checkin_time || "15:00";
          const checkoutTime = acc.checkout_time || "11:00";

          return (
            <div key={acc.id} className="card overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-50 to-white px-5 py-4 border-b border-slate-100/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl md:text-2xl">{city?.country_flag}</span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 text-sm md:text-base leading-tight">{acc.name}</h3>
                      <p className="text-[11px] md:text-xs text-slate-400 mt-0.5">
                        {city?.name} · {acc.nights}박
                        {acc.breakfast_included ? " · 조식포함" : ""}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] md:text-xs px-3 py-1 rounded-full font-semibold flex-shrink-0 ml-2 ${
                    acc.source === "NOL" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500"
                  }`}>
                    {acc.source || ""}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">
                {/* Check-in / Check-out */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50/50 rounded-xl p-3">
                    <p className="text-[10px] md:text-xs text-slate-400 mb-0.5">체크인</p>
                    <p className="text-sm md:text-base font-bold text-slate-800">
                      {formatDate(acc.checkin_date)}
                    </p>
                    <p className="text-xs md:text-sm text-blue-500 font-semibold">{checkinTime} 이후</p>
                  </div>
                  <div className="bg-rose-50/50 rounded-xl p-3">
                    <p className="text-[10px] md:text-xs text-slate-400 mb-0.5">체크아웃</p>
                    <p className="text-sm md:text-base font-bold text-slate-800">
                      {formatDate(acc.checkout_date)}
                    </p>
                    <p className="text-xs md:text-sm text-rose-500 font-semibold">{checkoutTime} 이전</p>
                  </div>
                </div>

                {/* Booking numbers */}
                {(info["예약번호"] || info["체크인번호"]) && (
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                    {info["예약번호"] && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] md:text-xs text-slate-400">예약번호</span>
                        <span className="text-xs md:text-sm font-mono font-semibold text-slate-700">{info["예약번호"]}</span>
                      </div>
                    )}
                    {info["체크인번호"] && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] md:text-xs text-slate-400">체크인번호</span>
                        <span className="text-xs md:text-sm font-mono font-semibold text-slate-700">{info["체크인번호"]}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Price */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] md:text-xs text-slate-400">결제금액</span>
                    <p className="text-xl md:text-2xl font-bold text-slate-800">₩{(acc.total_price_krw || 0).toLocaleString()}</p>
                  </div>
                  {tax > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] md:text-xs text-slate-400">현지세금</span>
                      <p className="text-sm md:text-base font-bold text-amber-500">+ ₩{tax.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {/* Cancellation */}
                {acc.cancellation_policy && (
                  <p className="text-[10px] md:text-xs text-slate-400">
                    <span className="text-slate-300">취소: </span>{acc.cancellation_policy}
                  </p>
                )}

                {/* PDF download */}
                {(() => {
                  const pdfUrl = getPdfUrl(info);
                  return pdfUrl ? (
                    <div className="flex gap-2">
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden md:flex items-center justify-center gap-2 flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-medium rounded-xl transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        예약확인서 보기
                      </a>
                      <a
                        href={pdfUrl}
                        download
                        className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs md:text-sm font-medium rounded-xl transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        예약확인서 다운로드
                      </a>
                    </div>
                  ) : null;
                })()}

                {/* Address + Google Maps button */}
                {acc.address && (
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] md:text-xs text-slate-400 flex-1 min-w-0">{acc.address}</p>
                    <a
                      href={acc.booking_url || googleMapsUrl(acc.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-[10px] md:text-xs px-4 py-2 rounded-xl font-semibold hover:shadow-md hover:shadow-indigo-500/20 transition-all"
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
