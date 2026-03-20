import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "일정 관리 시스템",
  description: "동유럽 12일 여행 일정/예산/숙소/교통편 관리",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <Sidebar />
        <main className="md:ml-56 min-h-screen p-4 pt-14 md:pt-6 md:p-6">{children}</main>
      </body>
    </html>
  );
}
