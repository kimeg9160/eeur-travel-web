"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, BudgetItem, Accommodation, Transfer, ItineraryItem } from "@/lib/types";

const CAT_EMOJI: Record<string, string> = {
  "항공": "✈️", "숙소": "🏨", "교통": "🚆", "식비": "🍽️",
  "입장료": "🎫", "쇼핑": "🛍️", "보험": "🛡️", "예비비": "💳",
};
const CAT_COLORS: Record<string, string> = {
  "항공": "#ef4444", "숙소": "#3b82f6", "교통": "#f59e0b", "식비": "#10b981",
  "입장료": "#8b5cf6", "쇼핑": "#ec4899", "보험": "#6366f1", "예비비": "#94a3b8",
};

const DEFAULT_BUDGET = [
  { category: "항공", item_name: "인천-부다페스트 왕복", cost_eur: 0, cost_krw: 1800000 },
  { category: "숙소", item_name: "11박 숙소비 (예상)", cost_eur: 0, cost_krw: 2000000 },
  { category: "교통", item_name: "도시간 이동 (버스/기차)", cost_eur: 0, cost_krw: 300000 },
  { category: "식비", item_name: "12일 식비 (예상)", cost_eur: 0, cost_krw: 1000000 },
  { category: "입장료", item_name: "관광지 입장료", cost_eur: 0, cost_krw: 200000 },
  { category: "쇼핑", item_name: "쇼핑/기념품", cost_eur: 0, cost_krw: 500000 },
  { category: "보험", item_name: "여행자 보험", cost_eur: 0, cost_krw: 100000 },
  { category: "예비비", item_name: "예비비", cost_eur: 0, cost_krw: 400000 },
];

export default function BudgetPage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [accs, setAccs] = useState<Accommodation[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);

  const load = useCallback(async () => {
    const [t, b, a, tr, it] = await Promise.all([
      supabase.from("trips").select("*").eq("id", 1).single(),
      supabase.from("budget").select("*").eq("trip_id", 1).order("category"),
      supabase.from("accommodations").select("*").eq("trip_id", 1).eq("is_booked", 1),
      supabase.from("transfers").select("*").eq("trip_id", 1),
      supabase.from("itinerary").select("*").eq("trip_id", 1),
    ]);
    if (t.data) setTrip(t.data);
    if (b.data) setItems(b.data);
    if (a.data) setAccs(a.data);
    if (tr.data) setTransfers(tr.data);
    if (it.data) setItinerary(it.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function seedBudget() {
    for (const d of DEFAULT_BUDGET) {
      await supabase.from("budget").insert({ trip_id: 1, is_fixed: 0, note: "", ...d });
    }
    load();
  }

  async function toggleFixed(item: BudgetItem) {
    await supabase.from("budget").update({ is_fixed: item.is_fixed ? 0 : 1 }).eq("id", item.id);
    load();
  }

  async function deleteItem(id: number) {
    await supabase.from("budget").delete().eq("id", id);
    load();
  }

  if (!trip) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  if (!items.length) {
    return (
      <div className="text-center py-16">
        <h1 className="text-xl md:text-2xl font-bold text-slate-800 mb-4">예산</h1>
        <p className="text-slate-400 mb-6 text-sm">예산 데이터가 아직 없습니다.</p>
        <button onClick={seedBudget} className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-500/20 transition-all text-sm">
          기본 예산 생성
        </button>
      </div>
    );
  }

  const accActualKrw = accs.reduce((s, a) => s + (a.total_price_krw || 0), 0);
  const accActualEur = accs.reduce((s, a) => s + (a.total_price_eur || 0), 0);
  const flightActualKrw = transfers.filter(t => t.transport_type === "비행기").reduce((s, t) => s + (t.cost_krw || 0), 0);
  const flightActualEur = transfers.filter(t => t.transport_type === "비행기").reduce((s, t) => s + (t.cost_eur || 0), 0);
  const landActualKrw = transfers.filter(t => t.transport_type !== "비행기").reduce((s, t) => s + (t.cost_krw || 0), 0);
  const landActualEur = transfers.filter(t => t.transport_type !== "비행기").reduce((s, t) => s + (t.cost_eur || 0), 0);
  const transferActualKrw = flightActualKrw + landActualKrw;

  // 일정탭 식당+카페 → 식비, 쇼핑 → 쇼핑, 관광지 → 기타(입장료)
  const foodKrw = itinerary.filter(i => i.category === "식당" || i.category === "카페").reduce((s, i) => s + (i.cost_krw || 0), 0);
  const foodEur = itinerary.filter(i => i.category === "식당" || i.category === "카페").reduce((s, i) => s + (i.cost_eur || 0), 0);
  const shopKrw = itinerary.filter(i => i.category === "쇼핑").reduce((s, i) => s + (i.cost_krw || 0), 0);
  const shopEur = itinerary.filter(i => i.category === "쇼핑").reduce((s, i) => s + (i.cost_eur || 0), 0);
  const sightKrw = itinerary.filter(i => i.category === "관광지").reduce((s, i) => s + (i.cost_krw || 0), 0);
  const sightEur = itinerary.filter(i => i.category === "관광지").reduce((s, i) => s + (i.cost_eur || 0), 0);

  const syncMap: Record<string, { krw: number; eur: number }> = {
    "항공": { krw: flightActualKrw, eur: flightActualEur },
    "숙소": { krw: accActualKrw, eur: accActualEur },
    "교통": { krw: landActualKrw, eur: landActualEur },
    "식비": { krw: foodKrw, eur: foodEur },
    "쇼핑": { krw: shopKrw, eur: shopEur },
    "입장료": { krw: sightKrw, eur: sightEur },
  };
  const catCount: Record<string, number> = {};
  items.forEach((item) => { catCount[item.category] = (catCount[item.category] || 0) + 1; });
  const displayItems = items.map((item) => {
    const sync = syncMap[item.category];
    if (sync && (sync.krw > 0 || sync.eur > 0) && (catCount[item.category] || 0) === 1) {
      return { ...item, cost_krw: sync.krw, cost_eur: sync.eur };
    }
    return item;
  });

  const totalKrw = displayItems.reduce((s, b) => s + (b.cost_krw || 0), 0);
  const fixedKrw = displayItems.filter((b) => b.is_fixed).reduce((s, b) => s + (b.cost_krw || 0), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">예산</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "총 예산", value: `₩${(totalKrw / 10000).toFixed(0)}만`, gradient: "from-indigo-500 to-blue-500" },
          { label: "확정", value: `₩${(fixedKrw / 10000).toFixed(0)}만`, gradient: "from-emerald-400 to-teal-500" },
          { label: "미확정", value: `₩${((totalKrw - fixedKrw) / 10000).toFixed(0)}만`, gradient: "from-amber-400 to-orange-500" },
          { label: "1인 일평균", value: `₩${Math.round(totalKrw / 2 / (trip.total_days || 12) / 1000)}천`, gradient: "from-violet-400 to-purple-500" },
        ].map((s) => (
          <div key={s.label} className="card p-4 md:p-5">
            <p className="text-[10px] md:text-xs text-slate-400 font-medium">{s.label}</p>
            <p className="text-lg md:text-2xl font-bold mt-1">
              <span className={`bg-gradient-to-r ${s.gradient} bg-clip-text text-transparent`}>{s.value}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 실제 지출 현황 (도넛) */}
        <div className="card p-4 md:p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">실제 지출 현황</h3>
          <div className="flex items-center justify-center" style={{ height: 240 }}>
            {(() => {
              const confirmedFood = foodKrw;
              const confirmedShop = shopKrw;
              const confirmedSight = sightKrw;
              const segments = [
                { label: "항공", value: transfers.filter(t => t.transport_type === "비행기").reduce((s, t) => s + (t.cost_krw || 0), 0), color: CAT_COLORS["항공"] },
                { label: "숙소", value: accActualKrw, color: CAT_COLORS["숙소"] },
                { label: "교통", value: transfers.filter(t => t.transport_type !== "비행기").reduce((s, t) => s + (t.cost_krw || 0), 0), color: CAT_COLORS["교통"] },
                { label: "식비", value: confirmedFood, color: CAT_COLORS["식비"] },
                { label: "쇼핑", value: confirmedShop, color: CAT_COLORS["쇼핑"] },
                { label: "입장료", value: confirmedSight, color: CAT_COLORS["입장료"] },
                { label: "기타 예상", value: Math.max(0, totalKrw - accActualKrw - transferActualKrw - confirmedFood - confirmedShop - confirmedSight), color: "#e2e8f0" },
              ].filter(s => s.value > 0);
              const total = segments.reduce((s, seg) => s + seg.value, 0);
              const confirmedTotal = accActualKrw + transferActualKrw + confirmedFood + confirmedShop + confirmedSight;
              const size = 200, cx = size / 2, cy = size / 2, r = 75, stroke = 30;
              let cumAngle = -90;
              const arcs = segments.map((seg) => {
                const pct = total > 0 ? seg.value / total : 0;
                const angle = Math.max(pct * 360, 0.5);
                const startAngle = cumAngle;
                cumAngle += angle;
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = ((startAngle + angle) * Math.PI) / 180;
                const largeArc = angle > 180 ? 1 : 0;
                const x1 = cx + r * Math.cos(startRad), y1 = cy + r * Math.sin(startRad);
                const x2 = cx + r * Math.cos(endRad), y2 = cy + r * Math.sin(endRad);
                return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`, ...seg };
              });
              return (
                <div className="flex items-center gap-6">
                  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    {arcs.map((arc, i) => (
                      <path key={i} d={arc.d} fill="none" stroke={arc.color} strokeWidth={stroke} strokeLinecap="round" />
                    ))}
                    <text x={cx} y={cy - 6} textAnchor="middle" className="text-2xl font-bold fill-slate-800">
                      {total > 0 ? Math.round((confirmedTotal / total) * 100) : 0}%
                    </text>
                    <text x={cx} y={cy + 14} textAnchor="middle" className="text-[11px] fill-slate-400">
                      확정됨
                    </text>
                  </svg>
                  <div className="space-y-2.5">
                    {segments.map((seg) => (
                      <div key={seg.label} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-md flex-shrink-0" style={{ background: seg.color }} />
                          <span className="text-slate-500">{seg.label}</span>
                        </div>
                        <span className="text-slate-800 font-bold ml-5">₩{(seg.value / 10000).toFixed(1)}만</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* 예약 현황 */}
        <div className="card p-4 md:p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">예약 현황</h3>
          <div className="space-y-4">
            {(() => {
              const bookedAccs = accs.length;
              const flightBooked = transfers.filter(t => t.transport_type === "비행기" && t.is_booked).length;
              const flightTotal = transfers.filter(t => t.transport_type === "비행기").length;
              const landBooked = transfers.filter(t => t.transport_type !== "비행기" && t.is_booked).length;
              const landTotal = transfers.filter(t => t.transport_type !== "비행기").length;

              const rows = [
                { icon: "✈️", label: "항공", booked: flightBooked, total: flightTotal, color: CAT_COLORS["항공"] },
                { icon: "🏨", label: "숙소", booked: bookedAccs, total: bookedAccs, color: CAT_COLORS["숙소"] },
                { icon: "🚆", label: "도시간 교통", booked: landBooked, total: landTotal, color: CAT_COLORS["교통"] },
              ];
              return rows.map((row) => {
                const pct = row.total > 0 ? Math.min((row.booked / row.total) * 100, 100) : 0;
                return (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs md:text-sm mb-1.5">
                      <span className="font-semibold text-slate-600">{row.icon} {row.label}</span>
                      <span className={`font-bold ${pct === 100 ? "text-emerald-500" : "text-amber-500"}`}>
                        {row.booked}/{row.total} {pct === 100 ? "✅" : ""}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#22c55e" : row.color }}
                      />
                    </div>
                    {row.booked < row.total && (
                      <p className="text-[10px] text-amber-500 mt-1">
                        {row.total - row.booked}건 현장구매
                      </p>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs">카테고리</th>
              <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs">항목명</th>
              <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs">EUR</th>
              <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs">KRW</th>
              <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs">확정</th>
              <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs">메모</th>
              <th className="px-5 py-3.5"></th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5">
                    {CAT_EMOJI[item.category] || ""} {item.category}
                    {syncMap[item.category] && (syncMap[item.category].krw > 0 || syncMap[item.category].eur > 0) && (catCount[item.category] || 0) === 1 && (
                      <span className="text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-md font-semibold">자동</span>
                    )}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-slate-700">{item.item_name}</td>
                <td className="px-5 py-3.5 text-right text-slate-400">€{(item.cost_eur || 0).toLocaleString()}</td>
                <td className="px-5 py-3.5 text-right font-semibold text-slate-800">₩{(item.cost_krw || 0).toLocaleString()}</td>
                <td className="px-5 py-3.5 text-center">
                  <button
                    onClick={() => toggleFixed(item)}
                    className={`w-5 h-5 rounded-md border-2 inline-flex items-center justify-center text-xs transition-all ${
                      item.is_fixed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {item.is_fixed ? "✓" : ""}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-slate-400 text-xs">{item.note}</td>
                <td className="px-5 py-3.5">
                  <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500 text-xs transition-colors">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {displayItems.map((item) => (
          <div key={item.id} className="card p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-400">
                {CAT_EMOJI[item.category] || ""} {item.category}
                {syncMap[item.category] && (syncMap[item.category].krw > 0 || syncMap[item.category].eur > 0) && (catCount[item.category] || 0) === 1 && (
                  <span className="ml-1 text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-md font-semibold">자동</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFixed(item)}
                  className={`w-5 h-5 rounded-md border-2 inline-flex items-center justify-center text-[10px] transition-all ${
                    item.is_fixed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200"
                  }`}
                >
                  {item.is_fixed ? "✓" : ""}
                </button>
                <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500 text-[10px] transition-colors">삭제</button>
              </div>
            </div>
            <div className="font-bold text-sm text-slate-800">{item.item_name}</div>
            <div className="flex gap-3 mt-1 text-xs">
              {(item.cost_eur || 0) > 0 && <span className="text-slate-400">€{item.cost_eur}</span>}
              <span className="font-semibold text-indigo-600">₩{(item.cost_krw || 0).toLocaleString()}</span>
            </div>
            {item.note && <div className="text-[10px] text-slate-300 mt-1">{item.note}</div>}
          </div>
        ))}
      </div>

      <p className="text-[10px] md:text-xs text-slate-300 mt-2">환율: 1 EUR = ₩{Number(trip.exchange_rate).toLocaleString()}</p>
    </div>
  );
}
