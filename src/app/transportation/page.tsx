"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, City, Transfer } from "@/lib/types";
import dynamic from "next/dynamic";

const GoogleMapView = dynamic(() => import("@/components/GoogleMapView"), { ssr: false });

const TRANSPORT_EMOJI: Record<string, string> = {
  "버스": "🚌", "기차": "🚂", "셔틀": "🚐", "비행기": "✈️", "기타": "🚗",
};

const CITY_SHORT: Record<string, string> = {
  "서울(ICN)": "ICN", "부다페스트": "BUD", "빈": "VIE", "할슈타트": "HAL",
  "잘츠부르크": "SZG", "체스키 크룸로프": "CK", "프라하": "PRG",
};

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
    if (tr.data) setTransfers(tr.data);
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
    if (cityId && cityById[cityId]) return { name: cityById[cityId].name, flag: cityById[cityId].country_flag || "" };
    if (t.transport_type === "비행기") return { name: "서울(ICN)", flag: "🇰🇷" };
    return { name: "?", flag: "" };
  };

  const cityMarkers = cities
    .filter((c) => c.latitude && c.longitude)
    .map((c) => ({
      position: [c.latitude!, c.longitude!] as [number, number],
      label: c.name,
      popup: `<strong>${c.country_flag || ""} ${c.name}</strong>`,
      color: "#3b82f6",
    }));

  const routePolyline = cities
    .filter((c) => c.latitude && c.longitude)
    .map((c) => [c.latitude!, c.longitude!] as [number, number]);

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
                      {from.flag} {CITY_SHORT[fromName] || fromName} → {to.flag} {CITY_SHORT[toName] || toName}
                    </span>
                    <span className="hidden md:inline">
                      {from.flag} {fromName} → {to.flag} {toName}
                    </span>
                  </div>
                  <div className="text-[10px] md:text-sm text-slate-500 mt-0.5">
                    {t.operator || ""} · {t.transport_type || ""} · {t.duration || ""}
                    <span className="hidden md:inline">{t.date ? ` · ${t.date}` : ""}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {(t.cost_eur > 0) && <div className="font-semibold text-blue-600 text-sm md:text-base">€{t.cost_eur}</div>}
                  {(t.cost_krw > 0) && <div className="text-[10px] md:text-xs text-slate-500 hidden md:block">₩{t.cost_krw.toLocaleString()}</div>}
                  <div className={`text-[10px] md:text-xs font-semibold mt-0.5 md:mt-1 ${t.is_booked ? "text-green-600" : "text-amber-500"}`}>
                    {t.is_booked ? "✅ 완료" : "⏳ 미예약"}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBooked(t); }}
                  className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0 ${
                    t.is_booked ? "bg-green-500 border-green-500 text-white" : "border-slate-300 hover:border-slate-400"
                  }`}
                >
                  {t.is_booked ? "✓" : ""}
                </button>
              </div>

              {editing === t.id && (
                <EditPanel transfer={t} onSave={(data) => updateTransfer(t.id, data)} onCancel={() => setEditing(null)} />
              )}
            </div>
          );
        })}
      </div>

      {/* Map */}
      <h2 className="text-base md:text-lg font-bold text-slate-800 mb-2 md:mb-3">경로 지도</h2>
      <GoogleMapView center={[48.5, 15.0]} zoom={6} markers={cityMarkers} polyline={routePolyline} height="350px" />

      {/* Links */}
      <h2 className="text-base md:text-lg font-bold text-slate-800 mt-6 md:mt-8 mb-2 md:mb-3">교통편 검색</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
        {[
          { name: "FlixBus", icon: "🚌" },
          { name: "ÖBB", icon: "🚂", url: "https://www.oebb.at/en/" },
          { name: "RegioJet", icon: "🚌", url: "https://www.regiojet.com/" },
          { name: "CK Shuttle", icon: "🚐", url: "https://www.ckshuttle.cz/" },
          { name: "ČD", icon: "🚂", url: "https://www.cd.cz/en/" },
          { name: "Rome2Rio", icon: "🗺️", url: "https://www.rome2rio.com/" },
        ].map((l) => (
          <a
            key={l.name}
            href={l.url || `https://www.flixbus.com/`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-xl border border-slate-200 p-3 md:p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <span className="font-medium text-blue-600 text-xs md:text-base">{l.icon} {l.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function EditPanel({ transfer, onSave, onCancel }: {
  transfer: Transfer;
  onSave: (data: Partial<Transfer>) => void;
  onCancel: () => void;
}) {
  const [costEur, setCostEur] = useState(transfer.cost_eur || 0);
  const [costKrw, setCostKrw] = useState(transfer.cost_krw || 0);
  const [operator, setOperator] = useState(transfer.operator || "");
  const [duration, setDuration] = useState(transfer.duration || "");
  const [bookingUrl, setBookingUrl] = useState(transfer.booking_url || "");
  const [note, setNote] = useState(transfer.note || "");

  return (
    <div className="bg-slate-50 rounded-xl p-3 md:p-5 border border-slate-200 mt-1">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-2 md:mb-3">
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">운영사</label>
          <input className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={operator} onChange={(e) => setOperator(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">소요시간</label>
          <input className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">EUR</label>
          <input type="number" className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={costEur} onChange={(e) => setCostEur(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-[10px] md:text-xs text-slate-500">KRW</label>
          <input type="number" className="w-full border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm" value={costKrw} onChange={(e) => setCostKrw(Number(e.target.value))} />
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
          onClick={() => onSave({ cost_eur: costEur, cost_krw: costKrw, operator, duration, booking_url: bookingUrl, note })}
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
