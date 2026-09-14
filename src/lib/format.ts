export function explorerBase(chainId: number | null | undefined): string | null {
  if (chainId === 8453) return "https://basescan.org";
  if (chainId === 84532) return "https://sepolia.basescan.org";
  return null;
}

export function addressUrl(chainId: number | null | undefined, addr: string): string | null {
  const base = explorerBase(chainId);
  return base && /^0x[0-9a-fA-F]{40}$/.test(addr) ? `${base}/address/${addr}` : null;
}

export function networkLabel(chainId: number): string {
  if (chainId === 8453) return "Base";
  if (chainId === 84532) return "Base Sepolia";
  return `Chain ${chainId}`;
}

export function short(addr: string | null | undefined, n = 6): string {
  if (!addr) return "-";
  return addr.length > n * 2 + 2 ? `${addr.slice(0, n + 2)}…${addr.slice(-n + 2)}` : addr;
}

export function formatEth(wei: string | undefined): string {
  try {
    const v = BigInt(wei || "0");
    if (v === BigInt(0)) return "0 ETH";
    const whole = v / BigInt(1e18);
    const frac = (v % BigInt(1e18)).toString().padStart(18, "0").slice(0, 5).replace(/0+$/, "");
    return `${whole}${frac ? "." + frac : ""} ETH`;
  } catch {
    return `${wei} wei`;
  }
}

/** 21:44:02.113Z */
export function clock(iso: string | Date | null | undefined): string {
  if (!iso) return "--:--:--.---Z";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "--:--:--.---Z";
  return d.toISOString().slice(11, 23) + "Z";
}

export function ms(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}s`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  return `${Math.round(n)}ms`;
}

export function seq(n: number, width = 4): string {
  return String(n).padStart(width, "0");
}

export function relTime(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
