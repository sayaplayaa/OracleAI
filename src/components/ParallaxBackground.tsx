"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const LAYERS: { depth: number; className: string; shape: "tile" | "chart" | "scoreboard" | "glow" }[] = [
  { depth: 18, className: "top-[6%] left-[4%] w-40 h-24", shape: "tile" },
  { depth: -14, className: "top-[12%] right-[4%] w-56 h-32", shape: "chart" },
  { depth: 10, className: "bottom-[10%] left-[6%] w-64 h-16", shape: "scoreboard" },
  { depth: -22, className: "bottom-[18%] right-[8%] w-40 h-40", shape: "glow" },
  { depth: 26, className: "top-[42%] left-[42%] w-28 h-28", shape: "glow" },
];

function LayerShape({ shape }: { shape: (typeof LAYERS)[number]["shape"] }) {
  if (shape === "glow") {
    return (
      <div
        className="w-full h-full rounded-full blur-3xl opacity-25"
        style={{
          background: "radial-gradient(circle, var(--color-accent), transparent 70%)",
        }}
      />
    );
  }
  if (shape === "chart") {
    return (
      <div className="w-full h-full rounded-xl border border-border bg-surface/70 blur-[2px] opacity-40 p-3">
        <svg viewBox="0 0 100 40" className="w-full h-full">
          <polyline
            points="0,32 15,24 30,28 45,12 60,18 75,6 100,10"
            fill="none"
            stroke="var(--color-series-blue)"
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  }
  if (shape === "scoreboard") {
    return (
      <div className="w-full h-full rounded-lg border border-border bg-surface/70 blur-[2px] opacity-40 flex items-center gap-2 px-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-6 h-6 rounded bg-surface-raised" />
        ))}
      </div>
    );
  }
  return (
    <div className="w-full h-full rounded-lg border border-border bg-surface/70 blur-[2px] opacity-40 p-3 flex flex-col gap-2 justify-center">
      <div className="w-1/2 h-2 rounded bg-surface-raised" />
      <div className="w-3/4 h-4 rounded bg-accent/30" />
    </div>
  );
}

export function ParallaxBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const container = containerRef.current;
    if (!container) return;

    let raf = 0;
    function handlePointerMove(e: PointerEvent) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        container?.style.setProperty("--parallax-x", x.toFixed(3));
        container?.style.setProperty("--parallax-y", y.toFixed(3));
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const rootStyle = { "--parallax-x": 0, "--parallax-y": 0 } as CSSProperties;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={rootStyle}
      aria-hidden
    >
      {LAYERS.map((layer, i) => (
        <div
          key={i}
          className={`absolute ${layer.className} transition-transform duration-300 ease-out`}
          style={{
            transform: `translate(calc(var(--parallax-x) * ${layer.depth}px), calc(var(--parallax-y) * ${layer.depth}px))`,
          }}
        >
          <LayerShape shape={layer.shape} />
        </div>
      ))}
    </div>
  );
}
