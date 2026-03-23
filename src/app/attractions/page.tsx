"use client";

import { useState } from "react";

interface TicketOption {
  name: string;
  price: string;
  desc: string;
}

interface Attraction {
  id: number;
  city: string;
  cityFlag: string;
  date: string;
  name: string;
  reservationRequired: "필수" | "권장" | "불필요";
  timeSlot: string;
  bookingUrl: string;
  isBooked: boolean;
  note: string;
  tickets: TicketOption[];
}

const ATTRACTIONS: Attraction[] = [
  {
    id: 1,
    city: "빈",
    cityFlag: "🇦🇹",
    date: "2026-05-24",
    name: "벨베데레 궁전 (Upper Belvedere)",
    reservationRequired: "권장",
    timeSlot: "오전 추천",
    bookingUrl: "https://www.belvedere.at/en/go/tickets",
    isBooked: false,
    note: "클림트 <키스>는 Upper에 있음 | 타임슬롯 선택 필수 | 온라인 최대 15% 할인",
    tickets: [
      { name: "Upper Belvedere", price: "€19.50", desc: "클림트 <키스> 포함, 핵심 전시" },
      { name: "2 in 1 (Upper+Lower)", price: "€29", desc: "+ 기획전시" },
      { name: "3 in 1 (전부)", price: "€32", desc: "+ 현대미술관" },
    ],
  },
  {
    id: 2,
    city: "빈",
    cityFlag: "🇦🇹",
    date: "2026-05-24",
    name: "프라터 대관람차 (Wiener Riesenrad)",
    reservationRequired: "불필요",
    timeSlot: "자유",
    bookingUrl: "https://wienerriesenrad.com/en/tickets/",
    isBooked: false,
    note: "현장 구매 가능 | 프라터 놀이공원 입장은 무료",
    tickets: [
      { name: "일반 입장", price: "€14.50", desc: "현장 또는 온라인" },
    ],
  },
  {
    id: 3,
    city: "빈",
    cityFlag: "🇦🇹",
    date: "2026-05-25",
    name: "쇤브룬 궁전 (Schönbrunn Palace)",
    reservationRequired: "필수",
    timeSlot: "오후",
    bookingUrl: "https://www.schoenbrunn.at/en/tickets-and-prices/all-tickets-tours",
    isBooked: false,
    note: "오디오가이드 무료(한국어) | 입장시간 늦으면 티켓 무효 | 당일 입장 보장 안 됨",
    tickets: [
      { name: "Imperial Tour", price: "€22", desc: "22개 방" },
      { name: "Grand Tour", price: "€38", desc: "40개 방" },
      { name: "Classic Pass", price: "€57", desc: "40개 방 + 정원·미로·전망대" },
    ],
  },
];

const RESERVATION_STYLE = {
  "필수": "bg-red-100 text-red-700",
  "권장": "bg-amber-100 text-amber-700",
  "불필요": "bg-green-100 text-green-700",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`;
}

export default function AttractionsPage() {
  const [items] = useState<Attraction[]>(ATTRACTIONS);

  const byDate = items.reduce<Record<string, Attraction[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 md:mb-2">관광지 예약</h1>
      <p className="text-xs md:text-sm text-slate-500 mb-4 md:mb-6">
        {items.length}곳 · 예약 완료 {items.filter((i) => i.isBooked).length}/{items.length}
      </p>

      {Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dateItems]) => (
          <div key={date} className="mb-4 md:mb-6">
            <h2 className="text-sm md:text-base font-semibold text-slate-600 mb-2">
              {dateItems[0].cityFlag} {dateItems[0].city} · {formatDate(date)}
            </h2>
            <div className="space-y-3 md:space-y-4">
              {dateItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                >
                  <div className="px-4 py-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 text-sm md:text-base">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full font-medium ${RESERVATION_STYLE[item.reservationRequired]}`}>
                            예약 {item.reservationRequired}
                          </span>
                          {item.timeSlot !== "자유" && (
                            <span className="text-[10px] md:text-xs text-slate-400">{item.timeSlot}</span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] md:text-xs font-semibold flex-shrink-0 ${item.isBooked ? "text-green-600" : "text-amber-500"}`}>
                        {item.isBooked ? "✅ 완료" : "⏳ 미예약"}
                      </span>
                    </div>

                    {/* Ticket options */}
                    <div className="bg-slate-50 rounded-lg p-2.5 md:p-3 mb-3">
                      <table className="w-full text-[11px] md:text-xs">
                        <tbody>
                          {item.tickets.map((ticket, idx) => (
                            <tr key={idx} className={idx > 0 ? "border-t border-slate-200" : ""}>
                              <td className="py-1 pr-2 font-medium text-slate-700 whitespace-nowrap">{ticket.name}</td>
                              <td className="py-1 pr-2 font-bold text-blue-600 whitespace-nowrap">{ticket.price}</td>
                              <td className="py-1 text-slate-400">{ticket.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Note */}
                    {item.note && (
                      <p className="text-[10px] md:text-xs text-slate-400 mb-3">{item.note}</p>
                    )}

                    {/* Booking button */}
                    <a
                      href={item.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-medium rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      예약하기
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
