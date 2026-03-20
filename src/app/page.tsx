"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, City, Transfer, Accommodation, BudgetItem } from "@/lib/types";
import dynamic from "next/dynamic";

const GoogleMapView = dynamic(() => import("@/components/GoogleMapView"), { ssr: false });

export default function HomePage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [budget, setBudget] = useState<BudgetItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const tripRes = await supabase.from("trips").select("*").eq("id", 1).single();
        if (tripRes.error) { setError(`trips: ${tripRes.error.message}`); setLoading(false); return; }
        setTrip(tripRes.data);

        const [citiesRes, transfersRes, accRes, budgetRes] = await Promise.all([
          supabase.from("cities").select("*").eq("trip_id", 1).order("visit_order"),
          supabase.from("transfers").select("*").eq("trip_id", 1),
          supabase.from("accommodations").select("*").eq("trip_id", 1),
          supabase.from("budget").select("*").eq("trip_id", 1),
        ]);
        if (citiesRes.data) setCities(citiesRes.data);
        if (transfersRes.data) setTransfers(transfersRes.data);
        if (accRes.data) setAccommodations(accRes.data);
        if (budgetRes.data) setBudget(budgetRes.data);
      } catch (e) {
        setError(String(e));
      }
      setLoading(false);
    })();
  }, []);

  if (error) return <div className="text-red-500 p-4 md:p-8 bg-red-50 rounded-xl text-sm"><strong>에러:</strong> {error}</div>;
  if (loading || !trip) return <div className="text-slate-400 p-4 md:p-8">로딩 중...</div>;

  const today = new Date();
  const startDate = new Date(trip.start_date);
  const dDay = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const bookedCount = accommodations.filter((a) => a.is_booked).length;
  const citiesWithNights = cities.filter((c) => (c.nights ?? 0) > 0);
  const bookedTransfers = transfers.filter((t) => t.is_booked).length;
  const totalBudgetKrw = budget.reduce((s, b) => s + (b.cost_krw || 0), 0);
  const fixedBudgetKrw = budget.filter((b) => b.is_fixed).reduce((s, b) => s + (b.cost_krw || 0), 0);

  const cityMarkers = cities
    .filter((c) => c.latitude && c.longitude)
    .map((c) => ({
      position: [c.latitude!, c.longitude!] as [number, number],
      label: c.name,
      popup: `<strong>${c.country_flag || ""} ${c.name}</strong><br/>${c.checkin_date} ~ ${c.checkout_date}<br/>${c.nights ?? 0}박`,
      color: "#3b82f6",
    }));

  const routePolyline = cities
    .filter((c) => c.latitude && c.longitude)
    .map((c) => [c.latitude!, c.longitude!] as [number, number]);

  return (
    <div>
      <div className="bg-gradient-to-r from-blue-800 to-blue-500 text-white rounded-xl md:rounded-2xl p-4 md:p-8 mb-4 md:mb-6">
        <h1 className="text-xl md:text-3xl font-bold">{trip.name}</h1>
        <p className="text-blue-100 mt-1 text-xs md:text-base">
          {trip.start_date} ~ {trip.end_date} · {trip.total_days}일 {trip.total_nights}박
        </p>
        <div className="mt-3 md:mt-4 inline-block bg-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-lg md:text-xl font-bold">
          {dDay > 0 ? `D-${dDay}` : dDay === 0 ? "D-DAY!" : `D+${Math.abs(dDay)}`}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        {[
          { label: "여행 기간", value: `${trip.total_days}일 ${trip.total_nights}박` },
          { label: "방문 도시", value: `${cities.length}개` },
          { label: "숙소 예약", value: `${bookedCount}/${citiesWithNights.length}` },
          { label: "예산 합계", value: totalBudgetKrw ? `₩${(totalBudgetKrw / 10000).toFixed(0)}만` : "미설정" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-3 md:p-5 border border-slate-200">
            <p className="text-[10px] md:text-xs text-slate-500">{s.label}</p>
            <p className="text-base md:text-xl font-bold text-slate-800 mt-0.5 md:mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-base md:text-lg font-bold text-slate-800 mb-2 md:mb-3">여행 루트</h2>
      <div className="flex gap-1.5 md:gap-2 mb-4 md:mb-6 overflow-x-auto pb-2">
        {cities.map((city) => (
          <div key={city.id} className="bg-white rounded-xl border border-slate-200 p-2 md:p-3 text-center flex-shrink-0 min-w-[60px] md:min-w-[80px]">
            <div className="text-lg md:text-2xl">{city.country_flag}</div>
            <div className="font-bold text-[11px] md:text-sm mt-0.5 md:mt-1">{city.name}</div>
            <div className="text-[10px] md:text-xs text-slate-500">
              {(city.nights ?? 0) > 0 ? `${city.nights}박` : "당일"}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-base md:text-lg font-bold text-slate-800 mb-2 md:mb-3">전체 경로</h2>
      <div className="mb-4 md:mb-6">
        <GoogleMapView center={[48.5, 15.0]} zoom={6} markers={cityMarkers} polyline={routePolyline} height="300px" />
      </div>

      <h2 className="text-base md:text-lg font-bold text-slate-800 mb-2 md:mb-3">준비 상태</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
        {[
          { label: "숙소", current: bookedCount, total: citiesWithNights.length },
          { label: "교통편", current: bookedTransfers, total: Math.max(cities.length - 1, 0) },
          { label: "예산 확정", current: fixedBudgetKrw, total: totalBudgetKrw, isCurrency: true },
        ].map((s) => {
          const pct = s.total > 0 ? Math.min((s.current / s.total) * 100, 100) : 0;
          return (
            <div key={s.label} className="bg-white rounded-xl p-3 md:p-5 border border-slate-200">
              <p className="text-xs md:text-sm font-semibold text-slate-700 mb-1.5 md:mb-2">{s.label}</p>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-1.5 md:mb-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] md:text-xs text-slate-500">
                {"isCurrency" in s && s.isCurrency
                  ? `₩${(s.current / 10000).toFixed(0)}만 / ₩${(s.total / 10000).toFixed(0)}만`
                  : `${s.current} / ${s.total}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
