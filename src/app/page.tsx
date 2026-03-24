"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Trip, City, Transfer, Accommodation, BudgetItem } from "@/lib/types";

const TZ_KR = "Asia/Seoul";
const TZ_EU = "Europe/Prague"; // 체코/오스트리아/헝가리 동일 시간대

export default function HomePage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [budget, setBudget] = useState<BudgetItem[]>([]);
  const [checkDone, setCheckDone] = useState(0);
  const [checkTotal, setCheckTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [times, setTimes] = useState<Record<string, string>>({});
  const [rates, setRates] = useState<{ EUR: number | null; CZK: number | null; HUF: number | null }>({ EUR: null, CZK: null, HUF: null });
  const [convAmount, setConvAmount] = useState<string>("1");
  const [convFrom, setConvFrom] = useState<string>("EUR");
  const [convTo, setConvTo] = useState<string>("KRW");
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Real-time clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const fmt = (zone: string) => now.toLocaleString("ko-KR", {
        timeZone: zone, month: "short", day: "numeric", weekday: "short",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      });
      const krHour = parseInt(now.toLocaleString("en-US", { timeZone: TZ_KR, hour: "numeric", hour12: false }));
      const euHour = parseInt(now.toLocaleString("en-US", { timeZone: TZ_EU, hour: "numeric", hour12: false }));
      let diff = krHour - euHour;
      if (diff < 0) diff += 24;
      setTimes({ kr: fmt(TZ_KR), eu: fmt(TZ_EU), diff: String(diff) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch exchange rates
  const fetchRates = useCallback(async () => {
    try {
      setRatesLoading(true);
      setRatesError(null);
      const res = await fetch("https://api.frankfurter.dev/v1/latest?from=KRW&to=EUR,CZK,HUF");
      if (!res.ok) throw new Error("환율 정보를 가져올 수 없습니다");
      const data = await res.json();
      setRates({
        EUR: data.rates?.EUR ?? null,
        CZK: data.rates?.CZK ?? null,
        HUF: data.rates?.HUF ?? null,
      });
      setLastUpdated(
        new Date().toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      );
    } catch {
      setRatesError("환율 정보를 불러오지 못했습니다");
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
    const id = setInterval(fetchRates, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchRates]);

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

  // 체크리스트 (DB)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("checklist").select("is_done").eq("trip_id", 1);
      if (data) {
        setCheckTotal(data.length);
        setCheckDone(data.filter((i) => i.is_done).length);
      }
    })();
  }, []);

  if (error) return <div className="text-red-500 p-4 md:p-8 bg-red-50 rounded-xl text-sm"><strong>에러:</strong> {error}</div>;
  if (loading || !trip) return <div className="text-slate-400 p-4 md:p-8">로딩 중...</div>;

  const today = new Date();
  const startDate = new Date(trip.start_date);
  const dDay = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));


  const formatRate = (rate: number | null, currency: string) => {
    if (rate === null) return "-";
    const inverted = 1 / rate;
    if (currency === "EUR") return `${inverted.toFixed(0)} 원`;
    if (currency === "CZK") return `${inverted.toFixed(1)} 원`;
    return `${inverted.toFixed(2)} 원`;
  };

  return (
    <div>
      {/* 타이틀 배너 */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-500 text-white rounded-xl md:rounded-2xl p-4 md:p-6 mb-2 md:mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-2xl font-bold">{trip.name}</h1>
            <p className="text-blue-100 text-[11px] md:text-sm mt-0.5">
              {trip.start_date} ~ {trip.end_date} · {trip.total_nights}박 {trip.total_days}일
            </p>
          </div>
          <div className="bg-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-base md:text-xl font-bold">
            {dDay > 0 ? `D-${dDay}` : dDay === 0 ? "D-DAY!" : `D+${Math.abs(dDay)}`}
          </div>
        </div>
        {/* 시간 */}
        <div className="flex gap-3 mt-3 text-[11px] md:text-sm">
          <div className="bg-white/10 rounded-lg px-3 py-1.5 flex-1 flex justify-between">
            <span className="text-blue-200">🇰🇷 한국</span>
            <span className="font-mono">{times.kr || "..."}</span>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-1.5 flex-1 flex justify-between">
            <span className="text-blue-200">🇭🇺🇦🇹🇨🇿 현지</span>
            <span className="font-mono">{times.eu || "..."}</span>
          </div>
        </div>
      </div>

      {/* 여행 루트 - 국가별 */}
      <div className="flex items-stretch gap-0 mb-3 md:mb-4 bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {([
          { flag: "🇭🇺", country: "헝가리", dates: "5/21~23", cities: ["부다페스트"] },
          { flag: "🇦🇹", country: "오스트리아", dates: "5/24~27", cities: ["빈", "할슈타트", "잘츠부르크"] },
          { flag: "🇨🇿", country: "체코", dates: "5/28~6/1", cities: ["체스키크룸로프", "프라하"] },
        ]).map((group, gi) => (
          <div key={gi} className="flex items-center flex-1">
            {gi > 0 && <div className="text-slate-300 text-xs self-center px-0.5">→</div>}
            <div className="text-center flex-1 py-2 px-1 md:px-3">
              <div className="text-base md:text-xl">{group.flag}</div>
              <div className="text-[10px] md:text-xs font-semibold text-slate-700">{group.country}</div>
              <div className="text-[9px] md:text-[11px] text-slate-400">{group.dates}</div>
              <div className="text-[10px] md:text-xs text-slate-500 mt-0.5 leading-tight">
                {group.cities.join(", ")}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 환율 정보 + 변환기 */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-green-600" />
            <h3 className="font-semibold text-slate-700 text-sm md:text-base">환율</h3>
          </div>
          {lastUpdated && (
            <span className="text-[10px] text-slate-400">갱신: {lastUpdated}</span>
          )}
        </div>
        {ratesLoading ? (
          <p className="text-sm text-slate-400">환율 불러오는 중...</p>
        ) : ratesError ? (
          <p className="text-sm text-red-500">{ratesError}</p>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-3 text-[11px] md:text-xs text-slate-600">
              {([
                { flag: "🇪🇺", label: "EUR", key: "EUR" as const },
                { flag: "🇨🇿", label: "CZK", key: "CZK" as const },
                { flag: "🇭🇺", label: "HUF", key: "HUF" as const },
              ]).map((c) => (
                <span key={c.key}>
                  {c.flag} 1{c.label} = <strong className="text-slate-800">{formatRate(rates[c.key], c.key)}</strong>
                </span>
              ))}
            </div>

            {/* 변환기 */}
            <div className="border-t border-slate-200 pt-3 mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    value={convAmount}
                    onChange={(e) => setConvAmount(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-right"
                    placeholder="금액"
                  />
                </div>
                <select
                  value={convFrom}
                  onChange={(e) => setConvFrom(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-2 text-xs md:text-sm bg-white"
                >
                  <option value="KRW">🇰🇷 KRW</option>
                  <option value="EUR">🇪🇺 EUR</option>
                  <option value="CZK">🇨🇿 CZK</option>
                  <option value="HUF">🇭🇺 HUF</option>
                </select>
                <button
                  onClick={() => { setConvFrom(convTo); setConvTo(convFrom); }}
                  className="text-slate-400 hover:text-blue-600 transition-colors text-base"
                >↕</button>
                <select
                  value={convTo}
                  onChange={(e) => setConvTo(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-2 text-xs md:text-sm bg-white"
                >
                  <option value="KRW">🇰🇷 KRW</option>
                  <option value="EUR">🇪🇺 EUR</option>
                  <option value="CZK">🇨🇿 CZK</option>
                  <option value="HUF">🇭🇺 HUF</option>
                </select>
              </div>
              <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 text-right">
                <span className="text-base md:text-lg font-mono font-bold text-blue-700">
                  {(() => {
                    const amt = parseFloat(convAmount) || 0;
                    if (!amt || !rates.EUR) return "0";
                    const krwRates: Record<string, number> = {
                      KRW: 1,
                      EUR: rates.EUR,
                      CZK: rates.CZK || 0,
                      HUF: rates.HUF || 0,
                    };
                    const fromRate = krwRates[convFrom] || 1;
                    const toRate = krwRates[convTo] || 1;
                    const result = amt * (toRate / fromRate);
                    if (convTo === "KRW") return `₩${Math.round(result).toLocaleString()}`;
                    if (convTo === "HUF") return `${Math.round(result).toLocaleString()} HUF`;
                    return `${result.toFixed(2)} ${convTo}`;
                  })()}
                </span>
              </div>
            </div>
            <button onClick={fetchRates} className="text-xs text-blue-600 hover:underline">
              새로고침
            </button>
          </div>
        )}
      </div>

      {/* 준비 상태 */}
      <h2 className="text-base md:text-lg font-bold text-slate-800 mb-2 md:mb-3 mt-4 md:mt-6">준비 상태</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {(() => {
          const bookedAcc = accommodations.filter((a) => a.is_booked).length;
          const totalAcc = cities.filter((c) => (c.nights ?? 0) > 0).length;
          const bookedTr = transfers.filter((t) => t.is_booked).length;
          const totalTr = transfers.length;
          const fixedBudget = budget.filter((b) => b.is_fixed).reduce((s, b) => s + (b.cost_krw || 0), 0);
          const totalBudget = budget.reduce((s, b) => s + (b.cost_krw || 0), 0);
          return [
            { label: "숙소", current: bookedAcc, total: totalAcc },
            { label: "교통편", current: bookedTr, total: totalTr },
            { label: "예산 확정", current: fixedBudget, total: totalBudget, isCurrency: true },
            { label: "체크리스트", current: checkDone, total: checkTotal },
          ].map((s) => {
            const pct = s.total > 0 ? Math.min((s.current / s.total) * 100, 100) : 0;
            const display = "isCurrency" in s && s.isCurrency
              ? `₩${(s.current / 10000).toFixed(0)}만 / ₩${(s.total / 10000).toFixed(0)}만`
              : `${s.current} / ${s.total}`;
            return (
              <div key={s.label} className="bg-white rounded-xl p-3 md:p-4 border border-slate-200">
                <p className="text-[10px] md:text-xs text-slate-500 mb-1">{s.label}</p>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] md:text-xs font-semibold text-slate-700">{display}</p>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
