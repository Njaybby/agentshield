"use client";

import { useEffect, useState } from "react";
import { hasError, rpc } from "@/lib/rpc";
import type { CTIView, Overview, Scenario, Verdict } from "@/lib/types";

// One request per view per page load, shared by every landing section.
const cache = new Map<string, Promise<unknown>>();

function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, load());
  return cache.get(key) as Promise<T>;
}

function useView<T>(key: string, load: () => Promise<T | null>) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    once(key, load).then((d) => {
      if (!live) return;
      if (d === null) setFailed(true);
      else setData(d);
    });
    return () => {
      live = false;
    };
    // load is stable per key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, failed };
}

export function useOverview() {
  return useView<Overview>("overview", async () => {
    const r = await rpc<Overview>("telemetry", { view: "overview" });
    return hasError(r) ? null : r;
  });
}

export function useCti() {
  return useView<CTIView>("cti", async () => {
    const r = await rpc<CTIView>("telemetry", { view: "cti" });
    return hasError(r) ? null : r;
  });
}

export function useScenarios() {
  return useView<Scenario[]>("scenarios", async () => {
    const r = await rpc<{ attacks: Scenario[] }>("scenarios");
    return hasError(r) ? null : r.attacks;
  });
}

export function useRecentVerdicts() {
  return useView<Verdict[]>("verdicts", async () => {
    const r = await rpc<{ verdicts: Verdict[] }>("telemetry", { view: "verdicts" });
    return hasError(r) ? null : r.verdicts;
  });
}
