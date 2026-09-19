import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project Chrono",
  description: "Global Financial Intelligence Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0f] text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
