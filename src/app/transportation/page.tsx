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
        // 같은 날: 출발 도시 순 → 도착 도시 순
        const aFrom = visitOrder[a.from_city_id ?? 0] ?? 99;
        const bFrom = visitOrder[b.from_city_id ?? 0] ?? 99;
        if (aFrom !== bFrom) return aFrom - bFrom;
        const aTo = visitOrder[a.to_city_id ?? 0] ?? 99;
        const bTo = visitOrder[b.to_city_id ?? 0] ?? 99;
        if (aTo !== bTo) return aTo - bTo;
        // 같은 구간: id 순 (환승 1→2)
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

  if (!trip) return <div className="text-slate-400 p-4 md:p-8">로딩 중...</div>;

  const cityById = Object.fromEntries(cities.map((c) => [c.id, c]));

  // ICN(서울)은 DB 도시 목록에 없으므로 from/to가 null일 때 항공편 노트에서 유추
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
    <div>
      <h1 className="text-lg md:text-2xl font-bold text-slate-800 mb-4 md:mb-6">교통편</h1>

      {/* Route cards */}
      <div className="space-y-2 md:space-y-3 mb-6 md:mb-8">
        {transfers.map((t) => {
          const from = getLabel(t, true);
          const to = getLabel(t, false);
          const emoji = TRANSPORT_EMOJI[t.transport_type || ""] || "🚗";
          const fromName = from.name;
          const toName = to.name;

          return (
            <div key={t.id}>
              <div
                className="flex items-center gap-2.5 md:gap-4 bg-white rounded-xl p-3 md:p-5 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
                onClick={() => setEditing(editing === t.id ? null : t.id)}
              >
                <div className="text-xl md:text-3xl">{emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 text-sm md:text-base">
                    <span className="md:hidden">
                      {from.flag} {from.short} → {to.flag} {to.short}
                    </span>
                    <span className="hidden md:inline">
                      {from.flag} {fromName} → {to.flag} {toName}
                    </span>
                  </div>
                  <div className="text-[10px] md:text-sm text-slate-500 mt-0.5">
                    {t.operator || ""} · {t.transport_type || ""} · {formatDuration(t.duration)}
                    <span className="hidden md:inline">{t.date ? ` · ${t.date}` : ""}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {(t.cost_krw > 0) && <div className="font-semibold text-blue-600 text-sm md:text-base">₩{t.cost_krw.toLocaleString()}</div>}
                  {(t.cost_eur > 0) && <div className="text-[10px] md:text-xs text-slate-500">€{t.cost_eur}</div>}
                  <div className={`text-[10px] md:text-xs font-semibold mt-0.5 md:mt-1 ${t.is_booked ? "text-green-600" : "text-amber-500"}`}>
                    {t.is_booked ? "✅ 완료" : "🏷️ 현장구매"}
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromName)}&destination=${encodeURIComponent(toName)}&travelmode=transit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"
                  title="Google Maps 경로"
                >
                  <svg className="w-3.5 h-3.5 md:w-4 md:h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                </a>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBooked(t); }}
                  className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0 ${
                    t.is_booked ? "bg-green-500 border-green-500 text-white" : "border-slate-300 hover:border-slate-400"
                  }`}
                >
                  {t.is_booked ? "✓" : ""}
                </button>
              </div>

              {/* PDF 티켓 다운로드 */}
              {t.booking_url?.startsWith("/pdfs/") && (
                <div className="flex gap-2 mt-1 px-3 md:px-5">
                  <a
                    href={t.booking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden md:flex items-center justify-center gap-1.5 flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
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
                    className="flex items-center justify-center gap-1.5 flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs md:text-sm font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <div className="bg-slate-50 rounded-xl p-3 md:p-5 border border-slate-200 mt-1">
      {/* 구간 / 교통수단 / 날짜 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-2 md:mb-3">
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">출발</label>
          <select className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm bg-white" value={fromCityId ?? ""} onChange={(e) => setFromCityId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">-</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.country_flag} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">도착</label>
          <select className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm bg-white" value={toCityId ?? ""} onChange={(e) => setToCityId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">-</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.country_flag} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">교통수단</label>
          <select className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm bg-white" value={transportType} onChange={(e) => setTransportType(e.target.value)}>
            {TRANSPORT_TYPES.map((t) => <option key={t} value={t}>{TRANSPORT_EMOJI[t] || ""} {t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">날짜</label>
          <input type="date" className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      {/* 운영사 / 소요시간 / 금액 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-2 md:mb-3">
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">운영사</label>
          <input className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={operator} onChange={(e) => setOperator(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">소요시간 (분)</label>
          <input type="number" className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">EUR</label>
          <input type="number" className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={costEur} onChange={(e) => handleEurChange(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">KRW <span className="text-slate-300">(×{RATE})</span></label>
          <input type="number" className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={costKrw} onChange={(e) => handleKrwChange(Number(e.target.value))} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 mb-2 md:mb-3">
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">예약 URL</label>
          <input className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">메모</label>
          <input className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ from_city_id: fromCityId, to_city_id: toCityId, transport_type: transportType, date: date || null, cost_eur: costEur, cost_krw: costKrw, operator, duration, booking_url: bookingUrl, note })}
          className="bg-blue-600 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium hover:bg-blue-700"
        >
          저장
        </button>
        <button onClick={onCancel} className="bg-white text-slate-600 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm border border-slate-200">
          취소
        </button>
      </div>
    </div>
  );
}
