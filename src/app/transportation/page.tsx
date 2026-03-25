"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, City, Transfer } from "@/lib/types";

const TRANSPORT_EMOJI: Record<string, string> = {
  "버스": "🚌", "기차": "🚂", "비행기": "✈️", "기타": "🎫",
};

function formatDuration(min: string | null) {
  const m = parseInt(min || "0");
  if (!m) return "";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}분`;
  if (r === 0) return `${h}시간`;
  return `${h}시간 ${r}분`;
}

export default function TransportationPage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [t, c, tr] = await Promise.all([
      supabase.from("trips").select("*").eq("id", 1).single(),
      supabase.from("cities").select("*").eq("trip_id", 1).order("visit_order"),
      supabase.from("transfers").select("*").eq("trip_id", 1).order("date"),
    ]);
    if (t.data) setTrip(t.data);
    if (c.data) setCities(c.data);
    if (tr.data && c.data) {
      const visitOrder = Object.fromEntries(c.data.map((city) => [city.id, city.visit_order ?? 99]));
      tr.data.sort((a, b) => {
        const da = a.date || "", db = b.date || "";
        if (da !== db) return da.localeCompare(db);
        const aFrom = visitOrder[a.from_city_id ?? 0] ?? 99;
        const bFrom = visitOrder[b.from_city_id ?? 0] ?? 99;
        if (aFrom !== bFrom) return aFrom - bFrom;
        const aTo = visitOrder[a.to_city_id ?? 0] ?? 99;
        const bTo = visitOrder[b.to_city_id ?? 0] ?? 99;
        if (aTo !== bTo) return aTo - bTo;
        return a.id - b.id;
      });
      setTransfers(tr.data);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleBooked(t: Transfer) {
    await supabase.from("transfers").update({ is_booked: t.is_booked ? 0 : 1 }).eq("id", t.id);
    load();
  }

  async function updateTransfer(id: number, data: Partial<Transfer>) {
    await supabase.from("transfers").update(data).eq("id", id);
    setEditing(null);
    load();
  }

  if (!trip) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  const cityById = Object.fromEntries(cities.map((c) => [c.id, c]));

  const getLabel = (t: Transfer, isFrom: boolean) => {
    const cityId = isFrom ? t.from_city_id : t.to_city_id;
    if (cityId && cityById[cityId]) {
      const c = cityById[cityId];
      return { name: c.name, short: c.short_code || c.name, flag: c.country_flag || "" };
    }
    if (t.transport_type === "비행기") return { name: "서울(ICN)", short: "ICN", flag: "🇰🇷" };
    return { name: "?", short: "?", flag: "" };
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">교통편</h1>

      {/* Route cards */}
      <div className="space-y-3">
        {transfers.map((t) => {
          const from = getLabel(t, true);
          const to = getLabel(t, false);
          const emoji = TRANSPORT_EMOJI[t.transport_type || ""] || "🚗";
          const fromName = from.name;
          const toName = to.name;

          return (
            <div key={t.id}>
              <div
                className="card card-interactive flex items-center gap-3 md:gap-4 p-4 md:p-5 cursor-pointer"
                onClick={() => setEditing(editing === t.id ? null : t.id)}
              >
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-xl md:text-2xl flex-shrink-0">
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 text-sm md:text-base">
                    <span className="md:hidden">
                      {from.flag} {from.short} → {to.flag} {to.short}
                    </span>
                    <span className="hidden md:inline">
                      {from.flag} {fromName} → {to.flag} {toName}
                    </span>
                  </div>
                  <div className="text-[10px] md:text-sm text-slate-400 mt-0.5">
                    {t.operator || ""} · {t.transport_type || ""} · {formatDuration(t.duration)}
                    <span className="hidden md:inline">{t.date ? ` · ${t.date}` : ""}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {(t.cost_krw > 0) && <div className="font-bold text-indigo-600 text-sm md:text-base">₩{t.cost_krw.toLocaleString()}</div>}
                  {(t.cost_eur > 0) && <div className="text-[10px] md:text-xs text-slate-400">€{t.cost_eur}</div>}
                  <div className={`text-[10px] md:text-xs font-semibold mt-1 ${t.is_booked ? "text-emerald-500" : "text-amber-500"}`}>
                    {t.is_booked ? "✅ 완료" : "🏷️ 현장구매"}
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromName)}&destination=${encodeURIComponent(toName)}&travelmode=transit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 transition-all"
                  title="Google Maps 경로"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                </a>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBooked(t); }}
                  className={`w-7 h-7 md:w-8 md:h-8 rounded-xl border-2 flex items-center justify-center text-xs flex-shrink-0 transition-all ${
                    t.is_booked ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {t.is_booked ? "✓" : ""}
                </button>
              </div>

              {/* PDF 티켓 다운로드 */}
              {t.booking_url?.startsWith("/pdfs/") && (
                <div className="flex gap-2 mt-2 px-3 md:px-5">
                  <a
                    href={t.booking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden md:flex items-center justify-center gap-2 flex-1 py-2.5 bg-white shadow-sm hover:shadow-md text-slate-600 text-sm font-medium rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    티켓 보기
                  </a>
                  <a
                    href={t.booking_url}
                    download
                    className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-white shadow-sm hover:shadow-md text-slate-600 text-xs md:text-sm font-medium rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    티켓 다운로드
                  </a>
                </div>
              )}

              {editing === t.id && (
                <EditPanel transfer={t} cities={cities} onSave={(data) => updateTransfer(t.id, data)} onCancel={() => setEditing(null)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TRANSPORT_TYPES = ["버스", "기차", "비행기", "기타"];

function EditPanel({ transfer, cities, onSave, onCancel }: {
  transfer: Transfer;
  cities: City[];
  onSave: (data: Partial<Transfer>) => void;
  onCancel: () => void;
}) {
  const RATE = 1700;
  const [transportType, setTransportType] = useState(transfer.transport_type || "기타");
  const [date, setDate] = useState(transfer.date || "");
  const [fromCityId, setFromCityId] = useState<number | null>(transfer.from_city_id);
  const [toCityId, setToCityId] = useState<number | null>(transfer.to_city_id);
  const [costEur, setCostEur] = useState(transfer.cost_eur || 0);
  const [costKrw, setCostKrw] = useState(transfer.cost_krw || 0);
  const handleEurChange = (v: number) => { setCostEur(v); setCostKrw(Math.round(v * RATE)); };
  const handleKrwChange = (v: number) => { setCostKrw(v); setCostEur(Math.round(v / RATE * 100) / 100); };
  const [operator, setOperator] = useState(transfer.operator || "");
  const [duration, setDuration] = useState(transfer.duration || "");
  const [bookingUrl, setBookingUrl] = useState(transfer.booking_url || "");
  const [note, setNote] = useState(transfer.note || "");

  return (
    <div className="card p-4 md:p-5 mt-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-[10px] md:text-xs text-slate-400 font-medium">출발</label>
          <select className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs md:text-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1" value={fromCityId ?? ""} onChange={(e) => setFromCityId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">-</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.country_flag} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-400 font-medium">도착</label>
          <select className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs md:text-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1" value={toCityId ?? ""} onChange={(e) => setToCityId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">-</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.country_flag} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-400 font-medium">교통수단</label>
          <select className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs md:text-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1" value={transportType} onChange={(e) => setTransportType(e.target.value)}>
            {TRANSPORT_TYPES.map((t) => <option key={t} value={t}>{TRANSPORT_EMOJI[t] || ""} {t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-400 font-medium">날짜</label>
          <input type="date" className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs md:text-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-[10px] md:text-xs text-slate-400 font-medium">운영사</label>
          <input className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs md:text-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1" value={operator} onChange={(e) => setOperator(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-400 font-medium">소요시간 (분)</label>
          <input type="number" className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs md:text-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-400 font-medium">EUR</label>
          <input type="number" className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs md:text-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1" value={costEur} onChange={(e) => handleEurChange(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-400 font-medium">KRW</label>
          <input type="number" className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs md:text-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1" value={costKrw} onChange={(e) => handleKrwChange(Number(e.target.value))} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[10px] md:text-xs text-slate-400 font-medium">예약 URL</label>
          <input className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs md:text-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-400 font-medium">메모</label>
          <input className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs md:text-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ from_city_id: fromCityId, to_city_id: toCityId, transport_type: transportType, date: date || null, cost_eur: costEur, cost_krw: costKrw, operator, duration, booking_url: bookingUrl, note })}
          className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white px-4 py-2 rounded-xl text-xs md:text-sm font-semibold hover:shadow-lg hover:shadow-indigo-500/20 transition-all"
        >
          저장
        </button>
        <button onClick={onCancel} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-xs md:text-sm font-medium hover:bg-slate-200 transition-colors">
          취소
        </button>
      </div>
    </div>
  );
}
