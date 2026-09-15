import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/steamAuth";
import { getProfile } from "@/lib/opendota";

async function getSessionProfile() {
  const cookieStore = await cookies();
  const accountId = verifySessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!accountId) return null;
  const profile = await getProfile(accountId).catch(() => null);
  return profile ? { accountId, ...profile.profile } : { accountId, personaname: null, avatarfull: null };
}

export async function SiteHeader() {
  const session = await getSessionProfile();

  return (
    <header className="border-b border-border bg-page/95 backdrop-blur sticky top-0 z-10">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-ink">
              Dota Coach <span className="text-accent">AI</span>
            </span>
          </Link>
          <Link
            href="/drafts"
            className="text-sm text-ink-secondary hover:text-ink transition"
          >
            Heroes
          </Link>
        </div>

        {session ? (
          <div className="flex items-center gap-3">
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
              {session.personaname ?? "My profile"}
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
            className="text-sm font-medium bg-accent hover:brightness-110 text-page px-3.5 py-1.5 rounded-md transition"
          >
            Sign in through Steam
          </a>
        )}
      </div>
    </header>
  );
}
