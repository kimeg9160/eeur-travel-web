import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "EEUR Travel",
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
        <main className="md:ml-60 min-h-screen p-4 pt-16 md:pt-8 md:p-8">{children}</main>
      </body>
    </html>
  );
}
