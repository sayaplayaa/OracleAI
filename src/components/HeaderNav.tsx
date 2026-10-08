"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { HeaderSearchBar } from "./HeaderSearchBar";
import { SteamIcon } from "./SteamIcon";

interface HeaderSession {
  accountId: number;
  personaname: string | null;
  avatarfull: string | null;
}

const LINKS = [
  { href: "/", label: "Главная", exact: true },
  { href: "/games", label: "Мои игры", needsSession: true },
  { href: "/drafts", label: "Мета" },
  { href: "/heroes", label: "Гайды" },
  { href: "/tournaments", label: "Турниры" },
  { href: "/challenges", label: "Пропуск" },
  { href: "/riddles", label: "Загадки" },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  if (href === "/games") return pathname.startsWith("/games") || pathname.startsWith("/analysis");
  return pathname.startsWith(href);
}

function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 font-display font-extrabold text-lg text-ink whitespace-nowrap tracking-tight"
    >
      <span
        className="w-7 h-7 rounded-lg bg-accent text-page flex items-center justify-center text-sm font-black"
        aria-hidden
      >
        D
      </span>
      Dota Coach <span className="text-accent">AI</span>
    </Link>
  );
}

function UserChip({ session }: { session: HeaderSession }) {
  return (
    <div className="flex items-center gap-3 shrink-0">
      <Link
        href={`/player/${session.accountId}`}
        className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink transition"
      >
        {session.avatarfull && (
          <Image src={session.avatarfull} alt="" width={28} height={28} className="rounded-lg" unoptimized />
        )}
        <span className="hidden xl:inline max-w-[140px] truncate">{session.personaname ?? "Игрок"}</span>
      </Link>
      <a href="/api/auth/logout" className="text-xs text-ink-muted hover:text-ink transition">
        Выйти
      </a>
    </div>
  );
}

function NavLinks({ session, pathname, className }: { session: HeaderSession | null; pathname: string; className: string }) {
  return (
    <nav className={className} aria-label="Разделы">
      {LINKS.filter((l) => !l.needsSession || session).map((link) => {
        const active = isActive(pathname, link.href, link.exact);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
              active ? "bg-surface-raised text-ink font-medium" : "text-ink-secondary hover:text-ink hover:bg-surface/70"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function HeaderNav({ session }: { session: HeaderSession | null }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-page/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-6">
        <Logo />
        <NavLinks session={session} pathname={pathname} className="hidden lg:flex items-center gap-0.5" />
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden md:block w-56 xl:w-64">
            <HeaderSearchBar sessionAccountId={session?.accountId ?? null} />
          </div>
          {session ? (
            <UserChip session={session} />
          ) : (
            <a
              href="/api/auth/steam"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-page hover:brightness-110 transition whitespace-nowrap"
            >
              <SteamIcon size={16} />
              Войти
            </a>
          )}
        </div>
      </div>
      <NavLinks
        session={session}
        pathname={pathname}
        className="lg:hidden flex items-center gap-1 overflow-x-auto scrollbar-none px-4 sm:px-6 pb-2"
      />
    </header>
  );
}
