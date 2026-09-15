import { SearchBar } from "@/components/SearchBar";
import { ParallaxBackground } from "@/components/ParallaxBackground";

export default function Home() {
  return (
    <div className="relative min-h-[calc(100vh-57px)] overflow-hidden">
      <ParallaxBackground />
      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 flex flex-col items-center text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink mb-3">
          Your personal Dota 2 AI coach
        </h1>
        <p className="text-ink-secondary max-w-xl mb-8">
          Sign in to jump straight to your own matches and trends, or look up
          any player below. Get a coaching report that cites the exact numbers
          behind every strength, weakness, and tip - no generic advice, only
          what your data shows.
        </p>

        <a
          href="/api/auth/steam"
          className="text-base font-medium bg-accent hover:brightness-110 text-page px-6 py-3 rounded-md transition mb-8"
        >
          Sign in through Steam
        </a>

        <div className="w-full flex items-center gap-3 mb-8">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-ink-muted uppercase tracking-wide">
            or look up a player
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <SearchBar />
        <p className="text-xs text-ink-muted mt-6">
          Try a Steam64 ID, a steamcommunity.com/profiles/ URL, an OpenDota
          account ID, or a player name.
        </p>
      </div>
    </div>
  );
}
