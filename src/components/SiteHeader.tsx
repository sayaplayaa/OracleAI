import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/steamAuth";
import { getProfile } from "@/lib/opendota";
import { HeaderSearchBar } from "./HeaderSearchBar";

async function getSessionProfile() {
  const cookieStore = await cookies();
  const accountId = verifySessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!accountId) return null;
  const profile = await getProfile(accountId).catch(() => null);
  return profile ? { accountId, ...profile.profile } : { accountId, personaname: null, avatarfull: null };
}

export async function SiteHeader() {
  const session = await getSessionProfile();
  const homeHref = session ? `/player/${session.accountId}` : "/";

  return (
    <header className="border-b border-border bg-page/95 backdrop-blur sticky top-0 z-10">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3.5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center gap-6 shrink-0">
          <Link href={homeHref} className="flex items-center gap-2">
            <span className="text-lg font-bold text-ink whitespace-nowrap">
              Dota Coach <span className="text-accent">AI</span>
            </span>
          </Link>
          <Link
            href="/drafts"
            className="text-sm text-ink-secondary hover:text-ink transition"
          >
            Heroes
          </Link>
          <Link
            href="/heroes"
            className="text-sm text-ink-secondary hover:text-ink transition"
          >
            Guides
          </Link>
          <Link
            href="/tournaments"
            className="text-sm text-ink-secondary hover:text-ink transition"
          >
            Tournaments
          </Link>
          <Link
            href="/challenges"
            className="text-sm text-ink-secondary hover:text-ink transition"
          >
            Challenges
          </Link>
          <Link
            href="/riddles"
            className="text-sm text-ink-secondary hover:text-ink transition"
          >
            Riddles
          </Link>
        </div>

        <div className="justify-self-center">
          <HeaderSearchBar sessionAccountId={session?.accountId ?? null} />
        </div>

        {session ? (
          <div className="flex items-center gap-3 shrink-0 justify-self-end">
            <Link
              href={`/player/${session.accountId}`}
              className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink transition"
            >
              {session.avatarfull && (
                <Image
                  src={session.avatarfull}
                  alt={session.personaname ?? "My profile"}
                  width={24}
                  height={24}
                  className="rounded"
                  unoptimized
                />
              )}
              <span className="hidden sm:inline">{session.personaname ?? "My profile"}</span>
            </Link>
            <a
              href="/api/auth/logout"
              className="text-xs text-ink-muted hover:text-ink transition"
            >
              Sign out
            </a>
          </div>
        ) : (
          <a
            href="/api/auth/steam"
            className="shrink-0 justify-self-end text-sm font-medium bg-accent hover:brightness-110 text-page px-3.5 py-1.5 rounded-md transition whitespace-nowrap"
          >
            Sign in through Steam
          </a>
        )}
      </div>
    </header>
  );
}
