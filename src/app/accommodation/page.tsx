"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, City, Accommodation } from "@/lib/types";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const TAG_COLORS: Record<string, string> = {
  "추천": "#16a34a", "가성비": "#2563eb", "럭셔리": "#dc2626",
  "뷰 맛집": "#f59e0b", "위치 좋은": "#8b5cf6", "위치 최고": "#8b5cf6",
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
      supabase.from("accommodations").select("*").eq("trip_id", 1),
    ]);
    if (t.data) setTrip(t.data);
    if (c.data) setCities(c.data);
    if (a.data) setAccs(a.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleBooked(acc: Accommodation) {
    await supabase.from("accommodations").update({ is_booked: acc.is_booked ? 0 : 1 }).eq("id", acc.id);
    load();
  }

  async function deleteAcc(id: number) {
    await supabase.from("accommodations").delete().eq("id", id);
    load();
  }

  if (!trip) return <div className="text-slate-400 p-8">로딩 중...</div>;

  const citiesWithNights = cities.filter((c) => (c.nights ?? 0) > 0);
  const cityById = Object.fromEntries(cities.map((c) => [c.id, c]));
  const filtered = selectedCity ? accs.filter((a) => a.city_id === selectedCity) : accs;

  // Group by city
  const grouped: Record<number, Accommodation[]> = {};
  filtered.forEach((a) => {
    const cid = a.city_id ?? 0;
    if (!grouped[cid]) grouped[cid] = [];
    grouped[cid].push(a);
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">🏨 숙소</h1>

      {/* City filter */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSelectedCity(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${!selectedCity ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
        >
          전체
        </button>
        {citiesWithNights.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCity(c.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedCity === c.id ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
          >
            {c.country_flag} {c.name}
          </button>
        ))}
      </div>

      {Object.entries(grouped).map(([cidStr, cityAccs]) => {
        const cid = Number(cidStr);
        const city = cityById[cid];
        if (!city) return null;

        const markers = cityAccs
          .filter((a) => a.latitude && a.longitude)
          .map((a) => ({
            position: [a.latitude!, a.longitude!] as [number, number],
            label: a.name,
            popup: `<strong>${a.name}</strong><br/>${a.tag || ""} · €${a.price_per_night_eur || 0}/박`,
            color: a.is_booked ? "#16a34a" : TAG_COLORS[a.tag || ""] || "#6b7280",
          }));

        const center = markers.length
          ? [markers[0].position[0], markers[0].position[1]] as [number, number]
          : [city.latitude || 48.5, city.longitude || 15.0] as [number, number];

        return (
          <div key={cid} className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1">
              {city.country_flag} {city.name} ({city.nights}박)
            </h2>
            <p className="text-sm text-slate-500 mb-4">{city.checkin_date} ~ {city.checkout_date}</p>

            <div className="grid grid-cols-5 gap-6">
              <div className="col-span-3 space-y-2">
                {cityAccs.map((acc) => (
                  <div key={acc.id} className="flex items-center gap-4 bg-white rounded-xl p-4 border border-slate-200">
                    <button
                      onClick={() => toggleBooked(acc)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0 ${
                        acc.is_booked ? "bg-green-500 border-green-500 text-white" : "border-slate-300"
                      }`}
                    >
                      {acc.is_booked ? "✓" : ""}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{acc.name}</span>
                        {acc.tag && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full text-white font-bold"
                            style={{ backgroundColor: TAG_COLORS[acc.tag] || "#6b7280" }}
                          >
                            {acc.tag}
                          </span>
                        )}
                      </div>
                      {acc.note && <div className="text-xs text-slate-500 mt-0.5">{acc.note}</div>}
                    </div>
                    <div className="text-sm text-slate-600">
                      ⭐ {acc.star_rating || 0} · 📊 {(acc.review_score || 0).toFixed(1)}
                    </div>
                    <div className="text-lg font-bold text-blue-600 whitespace-nowrap">
                      €{acc.price_per_night_eur || 0}<span className="text-xs font-normal text-slate-400">/박</span>
                    </div>
                    <button onClick={() => deleteAcc(acc.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                  </div>
                ))}
              </div>
              <div className="col-span-2">
                <MapView center={center} zoom={14} markers={markers} height="350px" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
