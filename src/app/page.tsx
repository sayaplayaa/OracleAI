import { SearchBar } from "@/components/SearchBar";

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 flex flex-col items-center text-center">
      <h1 className="text-3xl sm:text-4xl font-bold text-ink mb-3">
        Your personal Dota 2 AI coach
      </h1>
      <p className="text-ink-secondary max-w-xl mb-8">
        Look up a player to see detailed match stats and trends, then get a
        coaching report that cites the exact numbers behind every strength,
        weakness, and tip - no generic advice, only what your data shows.
      </p>
      <SearchBar />
      <p className="text-xs text-ink-muted mt-6">
        Try a Steam64 ID, a steamcommunity.com/profiles/ URL, an OpenDota
        account ID, or a player name.
      </p>
    </div>
  );
}
