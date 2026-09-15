import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8">{children}</div>;
}
