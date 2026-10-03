"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

export interface PoolInfo {
  address: string;
  name: string;
  other: string | null;
  price: number | null;
  url: string;
}

/** The principal token's pool on GeckoTerminal, or null when there is none. */
export function usePool(pToken: Address | null) {
  return useQuery({
    queryKey: ["pool", pToken],
    enabled: Boolean(pToken),
    staleTime: 300_000,
    queryFn: async (): Promise<PoolInfo | null> => {
      const r = await fetch(`/api/pool?token=${pToken}`);
      if (!r.ok) return null;
      return ((await r.json()) as { pool: PoolInfo | null }).pool;
    },
  });
}

/**
 * Fixed rate implied by the pool: one principal token redeems one share at maturity, so a price under one
 * share is a discount. Only computed when the pool's other side is the stock token itself.
 */
export function fixedRate(pool: PoolInfo | null | undefined, stock: Address, maturity: number, now: number): number | null {
  if (!pool || pool.price === null || !pool.other || pool.other !== stock.toLowerCase() || pool.price <= 0) return null;
  const years = (maturity - now) / (365 * 86_400);
  if (years <= 0) return null;
  return Math.pow(1 / pool.price, 1 / years) - 1;
}
