"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { Ratios } from "./ShieldField";
import { useOverview } from "./useLive";

const ShieldField = dynamic(() => import("./ShieldField"), { ssr: false });

const FALLBACK: Ratios = { allow: 0.35, block: 0.45, quarantine: 0.2 };

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function HeroVisual() {
  const { data } = useOverview();
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [gl, setGl] = useState<boolean | null>(null);

  useEffect(() => {
    setGl(hasWebGL());
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const s = data?.stats;
  const ratios: Ratios =
    s && s.total > 0 ? { allow: s.allowed / s.total, block: s.blocked / s.total, quarantine: s.quarantined / s.total } : FALLBACK;

  return (
    <div ref={box} className="relative aspect-[5/4] w-full max-w-full overflow-hidden rounded-[14px] border border-line bg-[#0c0c0e]">
      <div className="hairline-grid absolute inset-0 opacity-40" aria-hidden />
      {gl && <ShieldField ratios={ratios} animate={visible && !reduce} />}
      {gl === false && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center text-[13px] text-faint">
          The live shield view needs WebGL. The console works without it.
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-line bg-canvas/70 px-4 py-3 text-xs backdrop-blur-sm">
        <span className="text-faint">Proposals hitting the shield, in the ratio the recorder has seen</span>
        <span className="flex items-center gap-4">
          <Legend color="bg-allow" label="Allowed" value={s?.allowed} />
          <Legend color="bg-block" label="Blocked" value={s?.blocked} />
          <Legend color="bg-quarantine" label="Held" value={s?.quarantined} />
        </span>
      </div>
      <span className="sr-only">
        Animated view of transaction proposals reaching the shield. Allowed ones pass, blocked ones bounce off, held ones wait for a
        human.
      </span>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value?: number }) {
  return (
    <span className="flex items-center gap-1.5 text-mute">
      <span className={`h-2 w-2 rounded-[2px] ${color}`} aria-hidden />
      {label}
      <span className="font-mono tabular-nums text-ink">{value ?? "-"}</span>
    </span>
  );
}
