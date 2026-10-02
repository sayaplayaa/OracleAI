import type { ReactNode } from "react";

/** The page body width every section uses - the same container as the home page. */
export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 ${className}`}>{children}</div>
  );
}
