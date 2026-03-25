"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip, City, ItineraryItem, Accommodation, Transfer } from "@/lib/types";
import dynamic from "next/dynamic";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const GoogleMapView = dynamic(() => import("@/components/GoogleMapView"), { ssr: false });

/* ── Constants ── */
const CAT_EMOJI: Record<string, string> = {
  "관광지": "🏛️", "식당": "🍽️", "카페": "☕", "쇼핑": "🛍️", "숙소": "🏨", "이동": "🚌",
};
const CAT_COLOR: Record<string, string> = {
  "관광지": "#3b82f6", "식당": "#ef4444", "카페": "#f59e0b", "쇼핑": "#ec4899", "숙소": "#10b981", "이동": "#6b7280",
};
const COUNTRY_FLAGS: Record<string, string> = {
  "헝가리": "🇭🇺", "오스트리아": "🇦🇹", "체코": "🇨🇿",
};
const COUNTRY_SHORT: Record<string, string> = {
  "헝가리": "HU", "오스트리아": "AT", "체코": "CZ",
};
const CITY_LANDMARKS: Record<string, { name: string; position: [number, number]; type: "train" | "bus" }[]> = {
  "Budapest": [
    { name: "Keleti 역", position: [47.5003, 19.0839], type: "train" },
    { name: "Nyugati 역", position: [47.5098, 19.0556], type: "train" },
    { name: "Déli 역", position: [47.4971, 19.0256], type: "train" },
    { name: "Népliget 버스터미널", position: [47.4764, 19.0894], type: "bus" },
  ],
  "Vienna": [
    { name: "Wien Hbf", position: [48.1853, 16.3764], type: "train" },
    { name: "Westbahnhof", position: [48.1969, 16.3389], type: "train" },
    { name: "VIB Erdberg (FlixBus)", position: [48.1915, 16.4043], type: "bus" },
  ],
  "Hallstatt": [{ name: "Hallstatt Bhf", position: [47.5615, 13.6467], type: "train" }],
  "Salzburg": [
    { name: "Salzburg Hbf", position: [47.8131, 13.0459], type: "train" },
    { name: "Salzburg Hbf (FlixBus)", position: [47.8120, 13.0440], type: "bus" },
  ],
  "Český Krumlov": [{ name: "CK 버스터미널", position: [48.8106, 14.3146], type: "bus" }],
  "Linz": [{ name: "Linz Hbf", position: [48.2904, 14.2918], type: "train" }],
  "Prague": [
    { name: "Praha hl.n.", position: [50.0833, 14.4347], type: "train" },
    { name: "Florenc (FlixBus)", position: [50.0900, 14.4400], type: "bus" },
  ],
};
const TRANSPORT_EMOJI: Record<string, string> = {
  "버스": "🚌", "기차": "🚂", "비행기": "✈️", "기타": "🎫",
};
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/* ── Helpers ── */
const isMobile = () => typeof window !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);

function normalizeCategory(cat: string | null): string | null {
  if (cat === "바/펍") return "카페";
  return cat;
}

function gmapsUrl(name: string, googleMapsUrl?: string | null, lat?: number | null, lng?: number | null) {
  if (googleMapsUrl) return googleMapsUrl;
  if (lat && lng) return `https://www.google.com/maps?q=${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}

function formatDuration(min: string | null) {
  const m = parseInt(min || "0");
  if (!m) return "";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}분`;
  if (r === 0) return `${h}시간`;
  return `${h}시간 ${r}분`;
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

function sortItems(items: ItineraryItem[]) {
  return [...items].sort((a, b) => {
    // sort_order 우선 (null이면 뒤로)
    if (a.sort_order != null && b.sort_order != null) return a.sort_order - b.sort_order;
    if (a.sort_order != null) return -1;
    if (b.sort_order != null) return 1;
    // time 기준
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });
}

/* ── Sortable Card (itinerary item) ── */
function SortableCard({
  item,
  dragId,
  isHighlighted,
  isFirst,
  isLast,
  onSelect,
  onEdit,
  gmapsHref,
}: {
  item: ItineraryItem;
  dragId: string;
  isHighlighted: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onEdit: () => void;
  gmapsHref: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dragId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const dotColor = CAT_COLOR[item.category || ""] || "#3b82f6";

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch">
      {/* Timeline column */}
      <div className="flex flex-col items-center w-14 md:w-16 flex-shrink-0 relative">
        <span className="text-[9px] md:text-[10px] text-slate-400 font-medium leading-none absolute top-3 w-full text-center">
          {item.time ? item.time.slice(0, 5) : ""}
        </span>
        {!isFirst && <div className="w-0.5 flex-1 bg-slate-200" />}
        {isFirst && <div className="flex-1" />}
        <div className="relative z-10 my-1">
          <div
            className="w-3 h-3 rounded-full border-2 border-white"
            style={{ background: dotColor, boxShadow: `0 0 0 2px ${dotColor}30` }}
          />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-slate-200" />}
        {isLast && <div className="flex-1" />}
      </div>

      {/* Card */}
      <div className={`flex-1 flex items-stretch bg-white rounded-xl border transition-colors my-0.5 ${
        isHighlighted ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"
      }`}>
        <div className="flex-1 flex items-start gap-2 py-3 pl-3 pr-2 cursor-pointer min-w-0" onClick={onSelect}>
          <div className="text-base md:text-lg">{CAT_EMOJI[item.category || ""] || "📍"}</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-800 text-sm md:text-base truncate">{item.spot_name}</div>
            <div className="text-[10px] md:text-xs text-slate-500 mt-0.5">
              {item.category || ""}{item.time ? ` · ${item.time}` : ""}
            </div>
            {item.memo && <div className="text-[10px] md:text-xs text-slate-400 mt-0.5 line-clamp-1">{item.memo}</div>}
          </div>
          {item.cost_krw > 0 && (
            <div className="text-[10px] md:text-xs font-semibold text-blue-600 whitespace-nowrap">₩{item.cost_krw.toLocaleString()}</div>
          )}
        </div>
        <div className="flex flex-col items-center justify-center gap-1 pr-2 flex-shrink-0">
          <a href={gmapsHref} target={isMobile() ? "_self" : "_blank"} rel="noopener noreferrer"
            className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"
            onClick={(e) => e.stopPropagation()}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          </a>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button {...attributes} {...listeners}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-300 hover:text-slate-500 transition-colors cursor-grab active:cursor-grabbing touch-none">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sortable Transfer Card (compact, expandable) ── */
function SortableTransferCard({
  transfer,
  dragId,
  cityById,
  isFirst,
  isLast,
  isExpanded,
  onToggle,
  onEdit,
}: {
  transfer: Transfer;
  dragId: string;
  cityById: Record<number, City>;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dragId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const fromCity = transfer.from_city_id ? cityById[transfer.from_city_id] : null;
  const toCity = transfer.to_city_id ? cityById[transfer.to_city_id] : null;
  const emoji = TRANSPORT_EMOJI[transfer.transport_type || ""] || "🚗";
  const dotColor = "#f59e0b";

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch">
      {/* Timeline column */}
      <div className="flex flex-col items-center w-14 md:w-16 flex-shrink-0 relative">
        <span className="text-[9px] md:text-[10px] text-slate-400 font-medium leading-none absolute top-3 w-full text-center">
          {transfer.time ? transfer.time.slice(0, 5) : ""}
        </span>
        {!isFirst && <div className="w-0.5 flex-1 bg-slate-200" />}
        {isFirst && <div className="flex-1" />}
        <div className="relative z-10 my-1">
          <div className="w-3 h-3 rounded-full border-2 border-white" style={{ background: dotColor, boxShadow: `0 0 0 2px ${dotColor}30` }} />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-slate-200" />}
        {isLast && <div className="flex-1" />}
      </div>

      {/* Card */}
      <div className="flex-1 flex items-stretch bg-amber-50 rounded-xl border border-amber-200 my-0.5 overflow-hidden">
        {/* Content area (clickable to toggle) */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <div className="flex items-start gap-2 py-3 pl-3 pr-2">
            <div className="text-base md:text-lg">{emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-800 text-sm md:text-base truncate">
                {fromCity?.name || "서울"} → {toCity?.name || "서울"}
              </div>
              <div className="text-[10px] md:text-xs text-slate-500 mt-0.5">
                {transfer.operator || ""}{transfer.duration ? ` · ${formatDuration(transfer.duration)}` : ""}{!transfer.is_booked ? " · 현장구매" : ""}
              </div>
            </div>
            {transfer.cost_krw > 0 && (
              <div className="text-[10px] md:text-xs font-semibold text-amber-600 whitespace-nowrap">₩{transfer.cost_krw.toLocaleString()}</div>
            )}
          </div>
          {/* Expanded details */}
          {isExpanded && (
            <div className="px-3 pb-3 pt-0 text-[10px] md:text-xs text-slate-500 space-y-0.5 border-t border-amber-200">
              <div className="pt-2 flex flex-wrap gap-x-3">
                {transfer.time && <span>출발 {transfer.time.slice(0, 5)}</span>}
                {transfer.duration && <span>소요 {formatDuration(transfer.duration)}</span>}
                {transfer.is_booked ? <span className="text-emerald-600">예매완료</span> : <span className="text-amber-600">미예약 · 현장구매</span>}
              </div>
              {transfer.note && <div className="text-slate-400">{transfer.note}</div>}
              {transfer.cost_eur > 0 && <div className="text-slate-400">€{transfer.cost_eur}</div>}
              {fromCity && toCity && (
                <a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromCity.name)}&destination=${encodeURIComponent(toCity.name)}&travelmode=transit`}
                  target={isMobile() ? "_self" : "_blank"} rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700"
                  onClick={(e) => e.stopPropagation()}>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  Google Maps 길찾기
                </a>
              )}
            </div>
          )}
        </div>
        {/* Actions (right side, same as itinerary cards) */}
        <div className="flex flex-col items-center justify-center gap-1 pr-2 flex-shrink-0">
          {fromCity && toCity && (
            <a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromCity.name)}&destination=${encodeURIComponent(toCity.name)}&travelmode=transit`}
              target={isMobile() ? "_self" : "_blank"} rel="noopener noreferrer"
              className="w-7 h-7 flex items-center justify-center rounded-md bg-amber-100/50 hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"
              onClick={(e) => e.stopPropagation()}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            </a>
          )}
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-amber-100/50 hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button {...attributes} {...listeners}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-amber-100 text-slate-300 hover:text-slate-500 transition-colors cursor-grab active:cursor-grabbing touch-none"
            onClick={(e) => e.stopPropagation()}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Edit Modal ── */
function EditModal({
  item,
  dates,
  onClose,
  onSave,
  onDelete,
}: {
  item: ItineraryItem;
  dates: { date: string; label: string; dayNumber: number }[];
  onClose: () => void;
  onSave: (updated: Partial<ItineraryItem>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [spotName, setSpotName] = useState(item.spot_name);
  const [time, setTime] = useState(item.time || "");
  const [category, setCategory] = useState(item.category || "관광지");
  const [memo, setMemo] = useState(item.memo || "");
  const [costKrw, setCostKrw] = useState(item.cost_krw);
  const [costEur, setCostEur] = useState(item.cost_eur);
  const [mapsUrl, setMapsUrl] = useState(item.google_maps_url || "");
  const [selectedDate, setSelectedDate] = useState(item.date || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const matchDate = dates.find((d) => d.date === selectedDate);
      await onSave({
        id: item.id,
        spot_name: spotName.trim(),
        time: time || null,
        category,
        memo: memo || null,
        cost_krw: costKrw,
        cost_eur: costEur,
        google_maps_url: mapsUrl || null,
        date: selectedDate || null,
        day_number: matchDate ? matchDate.dayNumber : 0,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-800">일정 편집</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">장소명</label>
            <input type="text" value={spotName} onChange={(e) => setSpotName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">날짜</label>
            <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">미분류</option>
              {dates.map((d) => <option key={d.date} value={d.date}>{d.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">시간</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">카테고리</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {["관광지", "식당", "카페", "쇼핑"].map((c) => (
                  <option key={c} value={c}>{CAT_EMOJI[c]} {c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">비용 (KRW)</label>
              <input type="number" value={costKrw || ""} onChange={(e) => setCostKrw(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">비용 (EUR)</label>
              <input type="number" value={costEur || ""} onChange={(e) => setCostEur(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Google Maps URL</label>
            <input type="url" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://maps.app.goo.gl/..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">메모</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={2} />
          </div>
        </div>
        <div className="flex justify-between px-5 py-4 border-t border-slate-200">
          <button onClick={() => { if (confirm("삭제하시겠습니까?")) { onDelete(item.id); onClose(); } }}
            className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">삭제</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">취소</button>
            <button onClick={handleSave} disabled={!spotName.trim() || saving}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Transfer Edit Modal ── */
function TransferEditModal({
  transfer,
  cities,
  onClose,
  onSave,
  onDelete,
}: {
  transfer: Transfer;
  cities: City[];
  onClose: () => void;
  onSave: (updated: Partial<Transfer>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [operator, setOperator] = useState(transfer.operator || "");
  const [transportType, setTransportType] = useState(transfer.transport_type || "기차");
  const [time, setTime] = useState(transfer.time || "");
  const [duration, setDuration] = useState(transfer.duration || "");
  const [costKrw, setCostKrw] = useState(transfer.cost_krw);
  const [costEur, setCostEur] = useState(transfer.cost_eur);
  const [note, setNote] = useState(transfer.note || "");
  const [bookingUrl, setBookingUrl] = useState(transfer.booking_url || "");
  const [isBooked, setIsBooked] = useState(!!transfer.is_booked);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        id: transfer.id,
        operator: operator || null,
        transport_type: transportType,
        time: time || null,
        duration: duration || null,
        cost_krw: costKrw,
        cost_eur: costEur,
        note: note || null,
        booking_url: bookingUrl || null,
        is_booked: isBooked ? 1 : 0,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const fromCity = cities.find((c) => c.id === transfer.from_city_id);
  const toCity = cities.find((c) => c.id === transfer.to_city_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-800">
            교통편 편집 · {fromCity?.name || "서울"} → {toCity?.name || "서울"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">교통수단</label>
              <select value={transportType} onChange={(e) => setTransportType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {["기차", "버스", "비행기", "기타"].map((t) => (
                  <option key={t} value={t}>{TRANSPORT_EMOJI[t]} {t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">출발시간</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">운행사</label>
              <input type="text" value={operator} onChange={(e) => setOperator(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="RegioJet, FlixBus..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">소요시간 (분)</label>
              <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">비용 (KRW)</label>
              <input type="number" value={costKrw || ""} onChange={(e) => setCostKrw(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">비용 (EUR)</label>
              <input type="number" value={costEur || ""} onChange={(e) => setCostEur(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">예매 URL</label>
            <input type="url" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">메모</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={isBooked} onChange={(e) => setIsBooked(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300" />
            예매 완료
          </label>
        </div>
        <div className="flex justify-between px-5 py-4 border-t border-slate-200">
          <button onClick={() => { if (confirm("삭제하시겠습니까?")) { onDelete(transfer.id); onClose(); } }}
            className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">삭제</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">취소</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Add Modal (simplified) ── */
function AddModal({
  dates,
  currentDate,
  onClose,
  onSave,
}: {
  dates: { date: string; label: string; dayNumber: number }[];
  currentDate: string;
  onClose: () => void;
  onSave: (item: Partial<ItineraryItem>) => Promise<void>;
}) {
  const [spotName, setSpotName] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState("관광지");
  const [memo, setMemo] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!spotName.trim()) return;
    setSaving(true);
    try {
      const matchDate = dates.find((d) => d.date === selectedDate);
      await onSave({
        trip_id: 1,
        spot_name: spotName.trim(),
        time: time || null,
        category,
        memo: memo || null,
        google_maps_url: mapsUrl || null,
        date: selectedDate || null,
        day_number: matchDate ? matchDate.dayNumber : 0,
        cost_krw: 0,
        cost_eur: 0,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-800">일정 추가</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">장소명 *</label>
            <input type="text" value={spotName} onChange={(e) => setSpotName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="장소 이름" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">날짜</label>
            <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">미분류</option>
              {dates.map((d) => <option key={d.date} value={d.date}>{d.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">시간</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">카테고리</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {["관광지", "식당", "카페", "쇼핑"].map((c) => (
                  <option key={c} value={c}>{CAT_EMOJI[c]} {c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Google Maps URL</label>
            <input type="url" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://maps.app.goo.gl/..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">메모</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={2} placeholder="메모 (선택)" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">취소</button>
          <button onClick={handleSave} disabled={!spotName.trim() || saving}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? "저장 중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Import Google Maps List Modal ── */
function ImportListModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ name: string; lat: number | null; lng: number | null; google_maps_url: string; memo: string; category: string }[] | null>(null);
  const [saving, setSaving] = useState(false);

  const handleExtract = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/import-gmaps-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "추출 실패");
      setResults(data.places || []);
    } catch (err) {
      alert("추출 실패: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!results || results.length === 0) return;
    setSaving(true);
    try {
      const toInsert = results.map((p) => ({
        trip_id: 1,
        spot_name: p.name,
        latitude: p.lat,
        longitude: p.lng,
        google_maps_url: p.google_maps_url || null,
        memo: p.memo || null,
        category: p.category || "관광지",
        day_number: 0,
        date: null,
        cost_krw: 0,
        cost_eur: 0,
      }));
      const { error } = await supabase.from("itinerary").insert(toInsert);
      if (error) throw new Error(error.message);
      alert(`${toInsert.length}건 미분류로 추가 완료`);
      onImported();
      onClose();
    } catch (err) {
      alert("저장 실패: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-800">Google Maps 리스트 가져오기</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Google Maps 리스트 URL</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://maps.app.goo.gl/..." disabled={loading} />
          </div>
          {!results && (
            <button onClick={handleExtract} disabled={!url.trim() || loading}
              className="w-full px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {loading ? "추출 중... (1~2분 소요)" : "장소 추출"}
            </button>
          )}
          {results && (
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">{results.length}개 장소 (새 항목만)</div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {results.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                    <span>{CAT_EMOJI[p.category] || "📍"}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.lat && <span className="text-[10px] text-slate-400">📍</span>}
                  </div>
                ))}
                {results.length === 0 && <div className="text-sm text-slate-400 text-center py-4">새로운 장소가 없습니다 (모두 중복)</div>}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">닫기</button>
          {results && results.length > 0 && (
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? "저장 중..." : `${results.length}건 미분류로 저장`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════ Main Page ══════════════════════════════════════════ */
export default function SchedulePage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [accs, setAccs] = useState<Accommodation[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  // UI state
  const [selectedDate, setSelectedDate] = useState<string>(""); // date string or "" for 미분류
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [expandedAccIds, setExpandedAccIds] = useState<Set<number>>(new Set());
  const [expandedTransferIds, setExpandedTransferIds] = useState<Set<number>>(new Set());
  const mapRef = useRef<HTMLDivElement>(null);

  // Drag sensors
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  /* ── Load data ── */
  const loadData = useCallback(async () => {
    const [t, c, i, a, tr] = await Promise.all([
      supabase.from("trips").select("*").eq("id", 1).single(),
      supabase.from("cities").select("*").eq("trip_id", 1).order("visit_order"),
      supabase.from("itinerary").select("*").eq("trip_id", 1).order("day_number").order("sort_order").order("time"),
      supabase.from("accommodations").select("*").eq("trip_id", 1).order("checkin_date"),
      supabase.from("transfers").select("*").eq("trip_id", 1).order("date").order("sort_order").order("time"),
    ]);
    if (t.data) setTrip(t.data);
    if (c.data) setCities(c.data);
    if (i.data) setItems(i.data.map((item: ItineraryItem) => ({ ...item, category: normalizeCategory(item.category) })));
    if (a.data) setAccs(a.data);
    if (tr.data) setTransfers(tr.data);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Set initial selected date ── */
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (trip && !initialized) {
      setSelectedDate(trip.start_date);
      setInitialized(true);
    }
  }, [trip, initialized]);

  /* ── Derived data ── */
  const cityById = Object.fromEntries(cities.map((c) => [c.id, c]));
  const cityNameEnMap = Object.fromEntries(cities.filter((c) => c.name_en).map((c) => [c.name, c.name_en!]));

  // Build date tabs from trip
  const dates: { date: string; label: string; dayNumber: number }[] = [];
  if (trip) {
    const start = new Date(trip.start_date + "T00:00:00");
    const end = new Date(trip.end_date + "T00:00:00");
    let dayNum = 1;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dates.push({ date: ds, label: dateLabel(ds), dayNumber: dayNum++ });
    }
  }

  const isUnassigned = selectedDate === "";
  const isRegionMode = !!selectedRegion;
  const regionCountries = Array.from(new Set(cities.map((c) => c.country).filter(Boolean))) as string[];

  // Unassigned items: day_number === 0 or null date
  const unassignedItems = items.filter((i) => !i.date && (!i.day_number || i.day_number === 0));
  const unassignedCount = unassignedItems.length;

  // Display items
  let displayItems: ItineraryItem[];
  let displayAccs: Accommodation[];
  let displayTransfers: Transfer[];
  let mapLandmarkKeys: string[];

  if (isRegionMode) {
    const regionCityIds = cities.filter((c) => c.country === selectedRegion).map((c) => c.id);
    displayItems = sortItems(items.filter((i) => i.city_id && regionCityIds.includes(i.city_id)));
    displayAccs = accs.filter((a) => a.city_id && regionCityIds.includes(a.city_id));
    displayTransfers = transfers.filter((t) => {
      return (t.from_city_id && regionCityIds.includes(t.from_city_id)) ||
             (t.to_city_id && regionCityIds.includes(t.to_city_id));
    });
    mapLandmarkKeys = cities.filter((c) => c.country === selectedRegion && c.name_en).map((c) => c.name_en!);
  } else if (isUnassigned) {
    displayItems = sortItems(unassignedItems);
    displayAccs = [];
    displayTransfers = [];
    mapLandmarkKeys = [];
  } else {
    // Date-based selection: date 필드 우선, 없으면 day_number로 매칭
    const matchDate = dates.find((d) => d.date === selectedDate);
    displayItems = sortItems(
      items.filter((i) => {
        if (i.date) return i.date === selectedDate;
        if (matchDate && i.day_number === matchDate.dayNumber) return true;
        return false;
      })
    );
    displayAccs = accs.filter((a) => {
      if (!a.checkin_date || !a.checkout_date) return false;
      return selectedDate >= a.checkin_date && selectedDate < a.checkout_date;
    });
    displayTransfers = transfers.filter((t) => {
      if (t.date === selectedDate) return true;
      if (!t.date && t.from_city_id) {
        const fromCity = cityById[t.from_city_id];
        if (fromCity?.checkout_date === selectedDate) return true;
      }
      return false;
    });
    const city = displayItems[0]?.city_id ? cityById[displayItems[0].city_id] : null;
    const cityEn = city?.name_en || cityNameEnMap[city?.name || ""] || "";
    mapLandmarkKeys = cityEn ? [cityEn] : [];
  }

  // Filter out 숙소/이동 category from itinerary (they come from separate tables)
  const placeItems = displayItems.filter((i) => i.category !== "숙소" && i.category !== "이동");

  // ── Unified timeline: merge itinerary items + transfers, sort by sort_order then time ──
  type TimelineEntry = { type: "item"; data: ItineraryItem; sortKey: string; sortOrder: number } | { type: "transfer"; data: Transfer; sortKey: string; sortOrder: number };

  const timelineEntries: TimelineEntry[] = [
    ...placeItems.map((i) => ({
      type: "item" as const,
      data: i,
      sortKey: i.time || "99:99",
      sortOrder: i.sort_order ?? 9999,
    })),
    ...displayTransfers.map((t) => ({
      type: "transfer" as const,
      data: t,
      sortKey: t.time || "99:99",
      sortOrder: t.sort_order ?? 9999,
    })),
  ].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.sortKey.localeCompare(b.sortKey);
  });

  /* ── Map markers ── */
  const itineraryMarkers = placeItems
    .filter((i) => i.latitude && i.longitude)
    .map((i, idx) => ({
      position: [i.latitude!, i.longitude!] as [number, number],
      label: i.spot_name,
      popup: `<strong>${idx + 1}. ${i.spot_name}</strong><br/>${i.category || ""}${i.time ? " · " + i.time : ""}`,
      color: CAT_COLOR[i.category || ""] || "#3b82f6",
      itemId: i.id,
    }));

  const accMarkers = displayAccs
    .filter((a) => a.latitude && a.longitude)
    .map((a) => ({
      position: [a.latitude!, a.longitude!] as [number, number],
      label: a.name,
      popup: `<strong>🏨 ${a.name}</strong><br/>숙소`,
      color: CAT_COLOR["숙소"],
    }));

  const landmarkMarkers = mapLandmarkKeys.flatMap((key) =>
    (CITY_LANDMARKS[key] || []).map((lm) => ({
      position: lm.position,
      label: lm.name,
      popup: `<strong>${lm.type === "train" ? "🚂" : "🚌"} ${lm.name}</strong>`,
      color: lm.type === "train" ? "#0d9488" : "#d97706",
      shape: "square" as const,
    }))
  );

  const markers = [...itineraryMarkers, ...accMarkers, ...landmarkMarkers];
  const allPositions = markers.map((m) => m.position);
  const useBounds = allPositions.length >= 2;

  const center = markers.length
    ? [
        markers.reduce((s, m) => s + m.position[0], 0) / markers.length,
        markers.reduce((s, m) => s + m.position[1], 0) / markers.length,
      ] as [number, number]
    : [48.5, 15.0] as [number, number];

  // Highlighted marker index for map
  const highlightedMarkerIndex = highlightedItemId
    ? itineraryMarkers.findIndex((m) => (m as { itemId?: number }).itemId === highlightedItemId)
    : null;

  /* ── Header info ── */
  const currentDateInfo = dates.find((d) => d.date === selectedDate);
  const dayCity = displayItems[0]?.city_id ? cityById[displayItems[0].city_id] : null;

  /* ── Handlers ── */
  const handleSaveItem = useCallback(async (item: Partial<ItineraryItem>) => {
    const { error } = await supabase.from("itinerary").insert(item);
    if (error) { alert("저장 실패: " + error.message); return; }
    await loadData();
  }, [loadData]);

  const handleUpdateItem = useCallback(async (updated: Partial<ItineraryItem>) => {
    const { id, ...data } = updated;
    const { error } = await supabase.from("itinerary").update(data).eq("id", id);
    if (error) { alert("수정 실패: " + error.message); return; }
    await loadData();
  }, [loadData]);

  const handleDeleteItem = useCallback(async (id: number) => {
    const { error } = await supabase.from("itinerary").delete().eq("id", id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    await loadData();
  }, [loadData]);

  const handleUpdateTransfer = useCallback(async (updated: Partial<Transfer>) => {
    const { id, ...data } = updated;
    const { error } = await supabase.from("transfers").update(data).eq("id", id);
    if (error) { alert("수정 실패: " + error.message); return; }
    await loadData();
  }, [loadData]);

  const handleDeleteTransfer = useCallback(async (id: number) => {
    const { error } = await supabase.from("transfers").delete().eq("id", id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    await loadData();
  }, [loadData]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = timelineEntries.findIndex((e) => `${e.type}-${e.data.id}` === active.id);
    const newIndex = timelineEntries.findIndex((e) => `${e.type}-${e.data.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(timelineEntries, oldIndex, newIndex);

    // Assign new sort_order to all entries
    const itemUpdates: { id: number; sort_order: number }[] = [];
    const transferUpdates: { id: number; sort_order: number }[] = [];
    reordered.forEach((entry, idx) => {
      if (entry.type === "item") itemUpdates.push({ id: entry.data.id, sort_order: idx + 1 });
      else transferUpdates.push({ id: entry.data.id, sort_order: idx + 1 });
    });

    // Optimistic update
    setItems((prev) => {
      const newItems = [...prev];
      for (const u of itemUpdates) {
        const idx = newItems.findIndex((i) => i.id === u.id);
        if (idx !== -1) newItems[idx] = { ...newItems[idx], sort_order: u.sort_order };
      }
      return newItems;
    });
    setTransfers((prev) => {
      const newArr = [...prev];
      for (const u of transferUpdates) {
        const idx = newArr.findIndex((t) => t.id === u.id);
        if (idx !== -1) newArr[idx] = { ...newArr[idx], sort_order: u.sort_order };
      }
      return newArr;
    });

    // Persist
    for (const u of itemUpdates) {
      await supabase.from("itinerary").update({ sort_order: u.sort_order }).eq("id", u.id);
    }
    for (const u of transferUpdates) {
      await supabase.from("transfers").update({ sort_order: u.sort_order }).eq("id", u.id);
    }
  }, [timelineEntries]);

  /* ── Loading ── */
  if (!trip) return <div className="text-slate-400 p-4 md:p-8">로딩 중...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h1 className="text-lg md:text-2xl font-bold text-slate-800">일정</h1>
        <div className="flex gap-1.5">
          <button onClick={() => setImportModalOpen(true)}
            className="px-2.5 py-1.5 text-[11px] md:text-xs bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors">
            📋 리스트
          </button>
          <button onClick={() => setAddModalOpen(true)}
            className="px-2.5 py-1.5 text-[11px] md:text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            + 추가
          </button>
        </div>
      </div>

      {/* Date tabs */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-2">
        {dates.map((d) => (
          <button key={d.date}
            onClick={() => { setSelectedDate(d.date); setSelectedRegion(null); setHighlightedItemId(null); setMobileMapOpen(false); }}
            className={`px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-[11px] md:text-sm font-medium whitespace-nowrap transition-colors ${
              selectedDate === d.date && !isRegionMode
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}>
            {d.label}
          </button>
        ))}
        {/* 미분류 탭 */}
        <button
          onClick={() => { setSelectedDate(""); setSelectedRegion(null); setHighlightedItemId(null); setMobileMapOpen(false); }}
          className={`px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-[11px] md:text-sm font-medium whitespace-nowrap transition-colors ${
            isUnassigned && !isRegionMode
              ? "bg-slate-800 text-white"
              : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
          }`}>
          미분류{unassignedCount > 0 && ` (${unassignedCount})`}
        </button>
      </div>

      {/* Region tabs */}
      <div className="flex gap-1 mb-4 md:mb-6">
        {regionCountries.map((country) => (
          <button key={country}
            onClick={() => { setSelectedRegion(selectedRegion === country ? null : country); setHighlightedItemId(null); setMobileMapOpen(false); }}
            className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg text-[11px] md:text-xs font-medium transition-colors ${
              selectedRegion === country
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}>
            <span className="md:hidden">{COUNTRY_SHORT[country] || country}</span>
            <span className="hidden md:inline">{COUNTRY_FLAGS[country] || ""} {country}</span>
          </button>
        ))}
      </div>

      {/* Sub-header */}
      <div className="mb-3 md:mb-4">
        {isRegionMode ? (
          <h2 className="text-base md:text-xl font-bold text-slate-800">
            {COUNTRY_FLAGS[selectedRegion!] || ""} {selectedRegion}
            <span className="ml-2 text-sm font-normal text-slate-400">{placeItems.length}곳</span>
          </h2>
        ) : isUnassigned ? (
          <h2 className="text-base md:text-xl font-bold text-slate-800">미분류</h2>
        ) : (
          <h2 className="text-base md:text-xl font-bold text-slate-800">
            {dayCity?.country_flag} {dayCity?.name || ""} · {currentDateInfo?.label || selectedDate}
          </h2>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col md:grid md:grid-cols-5 gap-4 md:gap-6">
        {/* Map */}
        <div className="order-2 md:col-span-2 md:order-2" ref={mapRef}>
          {/* Mobile toggle */}
          <button
            onClick={() => setMobileMapOpen(!mobileMapOpen)}
            className="md:hidden w-full flex items-center justify-between px-3 py-2 mb-1 bg-white border border-slate-200 rounded-lg text-sm text-slate-600"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              지도 {mobileMapOpen ? "접기" : "펼치기"}
            </span>
            <svg className={`w-4 h-4 transition-transform ${mobileMapOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
          </button>
          <div className={`${mobileMapOpen ? "block" : "hidden"} md:block`}>
            <GoogleMapView
              center={center}
              zoom={14}
              markers={markers}
              height="280px"
              showMyLocation
              bounds={useBounds ? allPositions : undefined}
              highlightedMarkerIndex={highlightedMarkerIndex !== -1 ? highlightedMarkerIndex : null}
            />
            {landmarkMarkers.length > 0 && (
              <div className="flex gap-3 mt-1.5 text-[10px] md:text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#0d9488" }} /> 기차역
                </span>
                <span className="flex items-center gap-1">
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#d97706" }} /> 버스
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="order-1 md:col-span-3 md:order-1">
          {/* Accommodations (compact, collapsible) */}
          {displayAccs.map((acc) => {
            const isCheckin = acc.checkin_date === selectedDate;
            const isExpanded = expandedAccIds.has(acc.id);
            const toggleAcc = () => setExpandedAccIds((prev) => {
              const next = new Set(prev);
              if (next.has(acc.id)) next.delete(acc.id); else next.add(acc.id);
              return next;
            });
            return (
              <div key={`acc-${acc.id}`}
                className="bg-emerald-50 rounded-xl border border-emerald-200 mb-1.5 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer" onClick={toggleAcc}>
                  <span className="text-base">🏨</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-800 text-sm">{acc.name}</span>
                    <span className="text-[10px] md:text-xs text-slate-500 ml-1.5">
                      {isCheckin ? `체크인 ${acc.checkin_time || "15:00"}` : `${acc.nights || ""}박`}
                    </span>
                  </div>
                  <a href={acc.booking_url || gmapsUrl(acc.name, null, acc.latitude, acc.longitude)}
                    target={isMobile() ? "_self" : "_blank"} rel="noopener noreferrer"
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-emerald-100 hover:bg-blue-100 text-emerald-500 hover:text-blue-600 transition-colors"
                    onClick={(e) => e.stopPropagation()}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  </a>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 text-[10px] md:text-xs text-slate-500 space-y-0.5 border-t border-emerald-200">
                    <div className="pt-2">
                      {isCheckin && <span>체크인 {acc.checkin_time || "15:00"} 이후</span>}
                      {acc.checkout_time && <span> · 체크아웃 {acc.checkout_time}</span>}
                      {acc.nights && <span> · {acc.nights}박</span>}
                    </div>
                    {acc.address && <div className="text-slate-400">{acc.address}</div>}
                    {acc.price_per_night_krw && acc.price_per_night_krw > 0 && (
                      <div className="font-semibold text-emerald-600">₩{acc.price_per_night_krw.toLocaleString()}/박</div>
                    )}
                    {acc.note && <div className="text-slate-400">{acc.note}</div>}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unified timeline: itinerary items + transfers, sorted together */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={timelineEntries.map((e) => `${e.type}-${e.data.id}`)} strategy={verticalListSortingStrategy}>
              <div>
                {timelineEntries.map((entry, idx) => {
                  if (entry.type === "item") {
                    const item = entry.data as ItineraryItem;
                    return (
                      <SortableCard
                        key={`item-${item.id}`}
                        item={item}
                        dragId={`item-${item.id}`}
                        isHighlighted={highlightedItemId === item.id}
                        isFirst={idx === 0}
                        isLast={idx === timelineEntries.length - 1}
                        onSelect={() => {
                          const newId = highlightedItemId === item.id ? null : item.id;
                          setHighlightedItemId(newId);
                          if (newId && window.innerWidth < 768) {
                            setMobileMapOpen(true);
                          }
                        }}
                        onEdit={() => setEditingItem(item)}
                        gmapsHref={gmapsUrl(item.spot_name, item.google_maps_url, item.latitude, item.longitude)}
                      />
                    );
                  } else {
                    const t = entry.data as Transfer;
                    return (
                      <SortableTransferCard
                        key={`transfer-${t.id}`}
                        transfer={t}
                        dragId={`transfer-${t.id}`}
                        cityById={cityById}
                        isFirst={idx === 0}
                        isLast={idx === timelineEntries.length - 1}
                        isExpanded={expandedTransferIds.has(t.id)}
                        onToggle={() => setExpandedTransferIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                          return next;
                        })}
                        onEdit={() => setEditingTransfer(t)}
                      />
                    );
                  }
                })}
              </div>
            </SortableContext>
          </DndContext>

          {timelineEntries.length === 0 && !displayAccs.length && (
            <div className="text-center text-slate-400 text-sm py-8">
              {isUnassigned ? "미분류 일정이 없습니다" : "등록된 일정이 없습니다"}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {addModalOpen && (
        <AddModal
          dates={dates}
          currentDate={selectedDate}
          onClose={() => setAddModalOpen(false)}
          onSave={handleSaveItem}
        />
      )}
      {editingItem && (
        <EditModal
          item={editingItem}
          dates={dates}
          onClose={() => setEditingItem(null)}
          onSave={handleUpdateItem}
          onDelete={handleDeleteItem}
        />
      )}
      {editingTransfer && (
        <TransferEditModal
          transfer={editingTransfer}
          cities={cities}
          onClose={() => setEditingTransfer(null)}
          onSave={handleUpdateTransfer}
          onDelete={handleDeleteTransfer}
        />
      )}
      {importModalOpen && (
        <ImportListModal
          onClose={() => setImportModalOpen(false)}
          onImported={loadData}
        />
      )}
    </div>
  );
}
