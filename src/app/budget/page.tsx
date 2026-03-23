"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, BudgetItem, Accommodation, Transfer } from "@/lib/types";

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

  const load = useCallback(async () => {
    const [t, b, a, tr] = await Promise.all([
      supabase.from("trips").select("*").eq("id", 1).single(),
      supabase.from("budget").select("*").eq("trip_id", 1).order("category"),
      supabase.from("accommodations").select("*").eq("trip_id", 1).eq("is_booked", 1),
      supabase.from("transfers").select("*").eq("trip_id", 1),
    ]);
    if (t.data) setTrip(t.data);
    if (b.data) setItems(b.data);
    if (a.data) setAccs(a.data);
    if (tr.data) setTransfers(tr.data);
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

  if (!trip) return <div className="text-slate-400 p-4 md:p-8">로딩 중...</div>;

  if (!items.length) {
    return (
      <div className="text-center py-12 md:py-20">
        <h1 className="text-lg md:text-2xl font-bold text-slate-800 mb-3 md:mb-4">예산</h1>
        <p className="text-slate-500 mb-4 text-sm">예산 데이터가 아직 없습니다.</p>
        <button onClick={seedBudget} className="bg-blue-600 text-white px-5 py-2.5 md:px-6 md:py-3 rounded-lg font-medium hover:bg-blue-700 text-sm">
          기본 예산 생성
        </button>
      </div>
    );
  }

  // 실제 DB 확정 금액
  const accActualKrw = accs.reduce((s, a) => s + (a.total_price_krw || 0), 0);
  const transferActualKrw = transfers.reduce((s, t) => s + (t.cost_krw || 0), 0);

  const totalKrw = items.reduce((s, b) => s + (b.cost_krw || 0), 0);
  const fixedKrw = items.filter((b) => b.is_fixed).reduce((s, b) => s + (b.cost_krw || 0), 0);



  return (
    <div>
      <h1 className="text-lg md:text-2xl font-bold text-slate-800 mb-3 md:mb-4">예산</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        {[
          { label: "총 예산", value: `₩${(totalKrw / 10000).toFixed(0)}만` },
          { label: "확정", value: `₩${(fixedKrw / 10000).toFixed(0)}만` },
          { label: "미확정", value: `₩${((totalKrw - fixedKrw) / 10000).toFixed(0)}만` },
          { label: "1인 일평균", value: `₩${Math.round(totalKrw / 2 / (trip.total_days || 12) / 1000)}천` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-3 md:p-5 border border-slate-200">
            <p className="text-[10px] md:text-xs text-slate-500">{s.label}</p>
            <p className="text-base md:text-xl font-bold text-slate-800 mt-0.5 md:mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
        {/* 실제 지출 현황 (도넛) — DB 확정 금액 기반 */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-5">
          <h3 className="text-xs md:text-sm font-semibold text-slate-700 mb-2 md:mb-3">실제 지출 현황</h3>
          <div className="flex items-center justify-center" style={{ height: 240 }}>
            {(() => {
              const segments = [
                { label: "항공", value: transfers.filter(t => t.transport_type === "비행기").reduce((s, t) => s + (t.cost_krw || 0), 0), color: CAT_COLORS["항공"] },
                { label: "숙소", value: accActualKrw, color: CAT_COLORS["숙소"] },
                { label: "교통", value: transfers.filter(t => t.transport_type !== "비행기").reduce((s, t) => s + (t.cost_krw || 0), 0), color: CAT_COLORS["교통"] },
                { label: "기타 예상", value: Math.max(0, totalKrw - accActualKrw - transferActualKrw), color: "#e2e8f0" },
              ].filter(s => s.value > 0);
              const total = segments.reduce((s, seg) => s + seg.value, 0);
              const confirmedTotal = accActualKrw + transferActualKrw;
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
                <div className="flex items-center gap-4">
                  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    {arcs.map((arc, i) => (
                      <path key={i} d={arc.d} fill="none" stroke={arc.color} strokeWidth={stroke} strokeLinecap="butt" />
                    ))}
                    <text x={cx} y={cy - 6} textAnchor="middle" className="text-lg font-bold fill-slate-800">
                      {total > 0 ? Math.round((confirmedTotal / total) * 100) : 0}%
                    </text>
                    <text x={cx} y={cy + 12} textAnchor="middle" className="text-[10px] fill-slate-400">
                      확정됨
                    </text>
                  </svg>
                  <div className="space-y-2">
                    {segments.map((seg) => (
                      <div key={seg.label} className="text-[11px] md:text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: seg.color }} />
                          <span className="text-slate-600">{seg.label}</span>
                        </div>
                        <span className="text-slate-800 font-semibold ml-4">₩{(seg.value / 10000).toFixed(1)}만</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* 예약 현황 — 건수 기반 */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-5">
          <h3 className="text-xs md:text-sm font-semibold text-slate-700 mb-2 md:mb-3">예약 현황</h3>
          <div className="space-y-3 md:space-y-4">
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
                    <div className="flex justify-between text-xs md:text-sm mb-1">
                      <span className="font-medium">{row.icon} {row.label}</span>
                      <span className={`font-semibold ${pct === 100 ? "text-green-600" : "text-amber-500"}`}>
                        {row.booked}/{row.total} {pct === 100 ? "✅" : ""}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 md:h-2">
                      <div
                        className="h-1.5 md:h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#22c55e" : row.color }}
                      />
                    </div>
                    {row.booked < row.total && (
                      <p className="text-[10px] text-amber-500 mt-0.5">
                        {row.total - row.booked}건 미예약
                      </p>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Mobile: card list / Desktop: table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">카테고리</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">항목명</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">EUR</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">KRW</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-600">확정</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">메모</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">{CAT_EMOJI[item.category] || ""} {item.category}</td>
                <td className="px-4 py-3">{item.item_name}</td>
                <td className="px-4 py-3 text-right">€{(item.cost_eur || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-medium">₩{(item.cost_krw || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleFixed(item)}
                    className={`w-5 h-5 rounded border-2 inline-flex items-center justify-center text-xs ${
                      item.is_fixed ? "bg-green-500 border-green-500 text-white" : "border-slate-300"
                    }`}
                  >
                    {item.is_fixed ? "✓" : ""}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-500">{item.note}</td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteItem(item.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500">{CAT_EMOJI[item.category] || ""} {item.category}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFixed(item)}
                  className={`w-5 h-5 rounded border-2 inline-flex items-center justify-center text-[10px] ${
                    item.is_fixed ? "bg-green-500 border-green-500 text-white" : "border-slate-300"
                  }`}
                >
                  {item.is_fixed ? "✓" : ""}
                </button>
                <button onClick={() => deleteItem(item.id)} className="text-red-400 text-[10px]">삭제</button>
              </div>
            </div>
            <div className="font-semibold text-sm text-slate-800">{item.item_name}</div>
            <div className="flex gap-3 mt-1 text-xs">
              {(item.cost_eur || 0) > 0 && <span className="text-slate-500">€{item.cost_eur}</span>}
              <span className="font-medium text-blue-600">₩{(item.cost_krw || 0).toLocaleString()}</span>
            </div>
            {item.note && <div className="text-[10px] text-slate-400 mt-1">{item.note}</div>}
          </div>
        ))}
      </div>

      <p className="text-[10px] md:text-xs text-slate-400 mt-3 md:mt-4">환율: 1 EUR = ₩{Number(trip.exchange_rate).toLocaleString()}</p>
    </div>
  );
}
