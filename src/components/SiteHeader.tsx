import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-ink">
              Dota Coach <span className="text-series-blue">AI</span>
            </span>
          </Link>
          <Link
            href="/drafts"
            className="text-sm text-ink-secondary hover:text-ink transition"
          >
            Draft Explorer
          </Link>
        </div>
        <span className="text-xs text-ink-muted hidden sm:block">
          Match stats powered by OpenDota · Coaching by Claude
        </span>
      </div>
    </header>
  );
}
