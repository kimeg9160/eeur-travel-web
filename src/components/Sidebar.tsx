"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Wallet,
  Hotel,
  Search,
  Train,
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
];

export default function Sidebar() {
  const pathname = usePathname();

  const renderLink = ({ href, label, icon: Icon }: typeof MAIN_NAV[0]) => {
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
    <aside className="fixed left-0 top-0 h-full w-56 bg-white border-r border-slate-200 flex flex-col z-10">
      <div className="p-5 border-b border-slate-200">
        <h1 className="text-lg font-bold text-slate-800">
          📊 운영 대시보드
        </h1>
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
  );
}
