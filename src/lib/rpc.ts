"use client";

import type { Offline, RpcAction } from "./types";

export type RpcResult<T> = T | Offline | { error: string; offline?: false };

/** Browser to /api/rpc. Never throws: network failures come back as a typed Offline. */
export async function rpc<T>(action: RpcAction, body: object = {}): Promise<RpcResult<T>> {
  try {
    const res = await fetch("/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, action }),
      cache: "no-store",
    });
    return (await res.json()) as RpcResult<T>;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "network error", offline: true };
  }
}

export function hasError(x: unknown): x is { error: string; offline?: boolean } {
  return typeof x === "object" && x !== null && typeof (x as { error?: unknown }).error === "string";
}
