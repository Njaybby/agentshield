"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "@phosphor-icons/react";

// Comments and string literals only. Everything else stays ink.
const TOKEN = /((?<=^|\s)(?:\/\/|#)[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/gm;

function highlight(code: string): ReactNode[] {
  return code.split(TOKEN).map((part, i) => {
    if (i % 2 === 0) return part;
    const comment = part.startsWith("//") || part.startsWith("#");
    return (
      <span key={i} className={comment ? "text-faint" : "text-[#8fb8de]"}>
        {part}
      </span>
    );
  });
}

export function CodeBlock({ code, label, className = "" }: { code: string; label: string; className?: string }) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    window.setTimeout(() => setCopied(null), 1600);
  };
  return (
    <div className={`relative min-w-0 rounded-md border border-line bg-canvas ${className}`}>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="absolute right-2 top-2 inline-flex h-7 items-center gap-1 rounded-md border border-line-strong bg-panel px-2 text-xs text-mute transition-colors duration-[120ms] hover:text-ink"
      >
        {copied === "ok" ? <Check size={13} className="text-allow" aria-hidden /> : <Copy size={13} aria-hidden />}
        {copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed" : "Copy"}
      </button>
      <pre className="overflow-x-auto p-4 pr-24 font-mono text-[12.5px] leading-5 text-ink/90">
        <code>{highlight(code)}</code>
      </pre>
    </div>
  );
}

export type Lang = "python" | "typescript";

export function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="inline-flex rounded-md border border-line-strong p-0.5" role="tablist" aria-label="Language">
      {(
        [
          ["python", "Python"],
          ["typescript", "TypeScript"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={lang === id}
          onClick={() => onChange(id)}
          className={`h-7 rounded-[4px] px-3 text-[13px] transition-colors duration-[120ms] ${lang === id ? "bg-elevated text-ink" : "text-mute hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
