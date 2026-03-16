"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, City, Transfer } from "@/lib/types";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const TRANSPORT_EMOJI: Record<string, string> = {
  "버스": "🚌", "기차": "🚂", "셔틀": "🚐", "비행기": "✈️", "기타": "🚗",
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

  if (!trip) return <div className="text-slate-400 p-8">로딩 중...</div>;

  const cityById = Object.fromEntries(cities.map((c) => [c.id, c]));

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
      <h1 className="text-2xl font-bold text-slate-800 mb-6">🚆 교통편</h1>

      {/* Route cards */}
      <div className="space-y-3 mb-8">
        {transfers.map((t) => {
          const from = cityById[t.from_city_id ?? 0];
          const to = cityById[t.to_city_id ?? 0];
          const emoji = TRANSPORT_EMOJI[t.transport_type || ""] || "🚗";

          return (
            <div key={t.id}>
              <div
                className="flex items-center gap-4 bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
                onClick={() => setEditing(editing === t.id ? null : t.id)}
              >
                <div className="text-3xl">{emoji}</div>
                <div className="flex-1">
                  <div className="font-bold text-slate-800">
                    {from?.country_flag} {from?.name || "?"} → {to?.country_flag} {to?.name || "?"}
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {t.operator || ""} · {t.transport_type || ""} · {t.duration || ""}
                    {t.date ? ` · ${t.date}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  {(t.cost_eur > 0) && <div className="font-semibold text-blue-600">€{t.cost_eur}</div>}
                  {(t.cost_krw > 0) && <div className="text-xs text-slate-500">₩{t.cost_krw.toLocaleString()}</div>}
                  <div className={`text-xs font-semibold mt-1 ${t.is_booked ? "text-green-600" : "text-amber-500"}`}>
                    {t.is_booked ? "✅ 예약완료" : "⏳ 미예약"}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBooked(t); }}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm ${
                    t.is_booked ? "bg-green-500 border-green-500 text-white" : "border-slate-300 hover:border-slate-400"
                  }`}
                >
                  {t.is_booked ? "✓" : ""}
                </button>
              </div>

              {/* Edit panel */}
              {editing === t.id && (
                <EditPanel transfer={t} onSave={(data) => updateTransfer(t.id, data)} onCancel={() => setEditing(null)} />
              )}
            </div>
          );
        })}
      </div>

      {/* Map */}
      <h2 className="text-lg font-bold text-slate-800 mb-3">🌍 경로 지도</h2>
      <MapView center={[48.5, 15.0]} zoom={6} markers={cityMarkers} polyline={routePolyline} height="450px" />

      {/* Links */}
      <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">🔗 교통편 검색</h2>
      <div className="grid grid-cols-3 gap-3">
        {[
          { name: "🚌 FlixBus", url: "https://www.flixbus.com/" },
          { name: "🚂 ÖBB (오스트리아 철도)", url: "https://www.oebb.at/en/" },
          { name: "🚌 RegioJet", url: "https://www.regiojet.com/" },
          { name: "🚐 CK Shuttle", url: "https://www.ckshuttle.cz/" },
          { name: "🚂 Czech Railways (ČD)", url: "https://www.cd.cz/en/" },
          { name: "🗺️ Rome2Rio", url: "https://www.rome2rio.com/" },
        ].map((l) => (
          <a
            key={l.name}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-xl border border-slate-200 p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <span className="font-medium text-blue-600">{l.name}</span>
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
    <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mt-1">
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-500">운영사</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={operator} onChange={(e) => setOperator(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">소요시간</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">비용 (EUR)</label>
          <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={costEur} onChange={(e) => setCostEur(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-slate-500">비용 (KRW)</label>
          <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={costKrw} onChange={(e) => setCostKrw(Number(e.target.value))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-500">예약 URL</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">메모</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ cost_eur: costEur, cost_krw: costKrw, operator, duration, booking_url: bookingUrl, note })}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          💾 저장
        </button>
        <button onClick={onCancel} className="bg-white text-slate-600 px-4 py-2 rounded-lg text-sm border border-slate-200">
          취소
        </button>
      </div>
    </div>
  );
}
