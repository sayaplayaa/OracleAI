import type { Metadata } from "next";
import { Unbounded, Manrope, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { FloatingCoachWidget } from "@/components/FloatingCoachWidget";
import "./globals.css";

const display = Unbounded({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin", "cyrillic"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Dota Coach AI",
  description:
    "ИИ-тренер по Dota 2: разбор твоих игр на основе реальных данных матча.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border mt-8">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
            <span>
              Dota Coach <span className="text-accent">AI</span> · данные матчей: OpenDota и STRATZ
            </span>
            <span>Не связан с Valve. Dota 2 - товарный знак Valve Corporation.</span>
          </div>
        </footer>
        <FloatingCoachWidget />
      </body>
    </html>
  );
}
