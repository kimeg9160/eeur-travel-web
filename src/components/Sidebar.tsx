"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Home,
  Calendar,
  Wallet,
  Hotel,
  Train,
  Ticket,
  Languages,
  ClipboardCheck,
  Menu,
  X,
} from "lucide-react";

const MAIN_NAV = [
  { href: "/", label: "홈", icon: Home },
  { href: "/schedule", label: "일정", icon: Calendar },
  { href: "/budget", label: "예산", icon: Wallet },
  { href: "/accommodation", label: "숙소", icon: Hotel },
  { href: "/transportation", label: "교통편", icon: Train },
  { href: "/attractions", label: "관광지 예약", icon: Ticket },
];

const TOOLS_NAV = [
  { href: "/translator", label: "번역기", icon: Languages },
  { href: "/checklist", label: "체크리스트", icon: ClipboardCheck },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const renderLink = ({ href, label, icon: Icon }: (typeof MAIN_NAV)[0]) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-3 mx-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
          active
            ? "bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md shadow-indigo-500/20"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        }`}
      >
        <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
        {label}
      </Link>
    );
  };

  return (
    <>
      {/* 모바일 햄버거 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-30 p-2.5 rounded-xl bg-white/80 backdrop-blur-md shadow-md md:hidden"
        aria-label="메뉴 열기"
      >
        <Menu size={20} className="text-slate-700" />
      </button>

      {/* 오버레이 (모바일) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed left-0 top-0 h-full w-60 bg-white/95 backdrop-blur-xl flex flex-col z-40 transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
        style={{ boxShadow: "1px 0 20px rgba(0,0,0,0.04)" }}
      >
        <div className="p-5 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
              EEUR Travel
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5 tracking-wide">HU · AT · CZ</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-100 md:hidden"
            aria-label="메뉴 닫기"
          >
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 py-2 space-y-0.5">
          {MAIN_NAV.map(renderLink)}

          <div className="mx-6 my-3 border-t border-slate-100" />
          <p className="px-6 pb-1.5 text-[10px] font-semibold text-slate-300 uppercase tracking-widest">
            도구
          </p>
          {TOOLS_NAV.map(renderLink)}
        </nav>

        <div className="p-4 mx-3 mb-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50">
          <p className="text-[10px] text-slate-400">2026.05.21 ~ 06.01</p>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">11박 12일 동유럽</p>
        </div>
      </aside>
    </>
  );
}
