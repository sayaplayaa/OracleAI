import { PageContainer } from "./PageContainer";

function Block({ className }: { className: string }) {
  return <div className={`rounded-2xl bg-surface border border-border animate-pulse ${className}`} />;
}

/** Loading layout for pages that open with a banner: crumbs, banner, tabs and a grid of cards. */
export function BannerPageSkeleton({ label }: { label: string }) {
  return (
    <PageContainer className="space-y-6">
      <div className="h-5 w-64 rounded bg-surface animate-pulse" aria-hidden />
      <div
        className="rounded-2xl bg-surface border border-border h-[148px] flex items-center px-7 gap-6"
        style={{ boxShadow: "inset 4px 0 0 0 var(--color-accent)" }}
        aria-busy="true"
        aria-label={label}
      >
        <div className="w-[160px] h-[90px] rounded-xl bg-surface-raised animate-pulse shrink-0" />
        <div className="space-y-3 flex-1">
          <div className="h-3 w-32 rounded bg-surface-raised animate-pulse" />
          <div className="h-8 w-64 max-w-full rounded bg-surface-raised animate-pulse" />
          <p className="text-xs text-ink-muted flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden />
            {label}
          </p>
        </div>
      </div>
      <div className="h-11 w-80 max-w-full rounded-xl bg-surface border border-border animate-pulse" aria-hidden />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <Block key={i} className="h-[92px]" />
        ))}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6" aria-hidden>
        <Block className="h-[420px]" />
        <Block className="h-[420px]" />
      </div>
    </PageContainer>
  );
}

/** Loading layout for section pages: title block and a grid of cards. */
export function SectionPageSkeleton({ label }: { label: string }) {
  return (
    <PageContainer className="space-y-10">
      <div className="space-y-3 max-w-2xl" aria-busy="true" aria-label={label}>
        <div className="h-3 w-48 rounded bg-surface animate-pulse" />
        <div className="h-10 w-80 max-w-full rounded bg-surface animate-pulse" />
        <p className="text-sm text-ink-muted flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden />
          {label}
        </p>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <Block key={i} className="h-[150px]" />
        ))}
      </div>
    </PageContainer>
  );
}
