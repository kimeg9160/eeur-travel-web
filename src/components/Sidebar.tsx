"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Home,
  Calendar,
  Wallet,
  Hotel,
  Search,
  Train,
  Languages,
  Menu,
  X,
} from "lucide-react";

const MAIN_NAV = [
  { href: "/", label: "홈", icon: Home },
  { href: "/schedule", label: "일정", icon: Calendar },
  { href: "/budget", label: "예산", icon: Wallet },
  { href: "/accommodation", label: "숙소", icon: Hotel },
  { href: "/transportation", label: "교통편", icon: Train },
];

const TOOLS_NAV = [
  { href: "/search", label: "숙소 검색", icon: Search },
  { href: "/translator", label: "번역기", icon: Languages },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 페이지 이동 시 모바일 메뉴 닫기
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const renderLink = ({ href, label, icon: Icon }: (typeof MAIN_NAV)[0]) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
          active
            ? "bg-blue-50 text-blue-700 font-semibold border-r-2 border-blue-600"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        <Icon size={18} />
        {label}
      </Link>
    );
  };

  return (
    <>
      {/* 모바일 햄버거 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-30 p-2 rounded-lg bg-white shadow-md border border-slate-200 md:hidden"
        aria-label="메뉴 열기"
      >
        <Menu size={22} />
      </button>

      {/* 오버레이 (모바일) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed left-0 top-0 h-full w-56 bg-white border-r border-slate-200 flex flex-col z-40 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800">
            운영 대시보드
          </h1>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-slate-100 md:hidden"
            aria-label="메뉴 닫기"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 py-4">
          {MAIN_NAV.map(renderLink)}

          <div className="mx-5 my-3 border-t border-slate-200" />
          <p className="px-5 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            도구
          </p>
          {TOOLS_NAV.map(renderLink)}
        </nav>
      </aside>
    </>
  );
}
