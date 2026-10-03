"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { FACTORY_ADDRESS } from "@/config/network";
import { OFFERED, PROTOCOL } from "@/config/site";
import { STOCK_TOKENS, type StockToken } from "@/config/tokens";
import { erc20Abi, factoryAbi, seriesAbi } from "@/lib/abi";

export interface SeriesRow {
  key: string; // "spy"
  token: StockToken;
  maturity: number;
  address: Address | null;
  pToken: Address | null;
  yToken: Address | null;
  settled: boolean;
  multiplier: bigint; // 1e18 = 1
  locked: bigint; // pX supply, in shares
  yieldRaw: bigint; // credited + pending, raw stock tokens
  me: { stock: bigint; p: bigint; y: bigint; claimable: bigint; allowance: bigint };
}

const ZERO_ME = { stock: 0n, p: 0n, y: 0n, claimable: 0n, allowance: 0n };
const ZERO = "0x0000000000000000000000000000000000000000";

/** The offered tokens, in the site's order, whether or not their series exists yet. */
export function offeredTokens(): StockToken[] {
  return OFFERED.flatMap((s) => STOCK_TOKENS.filter((t) => t.symbol === s));
}

export function blankRows(): SeriesRow[] {
  return offeredTokens().map((token) => ({
    key: token.symbol.toLowerCase(),
    token,
    maturity: PROTOCOL.defaultMaturity,
    address: null,
    pToken: null,
    yToken: null,
    settled: false,
    multiplier: 10n ** 18n,
    locked: 0n,
    yieldRaw: 0n,
    me: ZERO_ME,
  }));
}

/** Every offered series read from chain; without a factory address, the real zeros. */
export function useSeries(account?: Address) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["series", FACTORY_ADDRESS, account ?? null],
    placeholderData: (prev) => prev ?? blankRows(),
    refetchInterval: 20_000,
    queryFn: async (): Promise<SeriesRow[]> => {
      const rows = blankRows();
      if (!client) return rows;
      return Promise.all(
        rows.map(async (row) => {
          const me = { ...ZERO_ME };
          if (account) me.stock = await client.readContract({ address: row.token.address, abi: erc20Abi, functionName: "balanceOf", args: [account] });
          if (!FACTORY_ADDRESS) return { ...row, me };
          const addr = await client.readContract({ address: FACTORY_ADDRESS, abi: factoryAbi, functionName: "seriesFor", args: [row.token.address, BigInt(row.maturity)] });
          if (!addr || addr === ZERO) return { ...row, me };
          const r = (functionName: "pToken" | "yToken" | "settled" | "multiplier" | "owedYield" | "pendingYield") =>
            client.readContract({ address: addr, abi: seriesAbi, functionName });
          const [pToken, yToken, settled, multiplier, owed, pending] = (await Promise.all([r("pToken"), r("yToken"), r("settled"), r("multiplier"), r("owedYield"), r("pendingYield")])) as [Address, Address, boolean, bigint, bigint, bigint];
          const locked = await client.readContract({ address: pToken, abi: erc20Abi, functionName: "totalSupply" });
          if (account) {
            const [p, y, claimable, allowance] = await Promise.all([
              client.readContract({ address: pToken, abi: erc20Abi, functionName: "balanceOf", args: [account] }),
              client.readContract({ address: yToken, abi: erc20Abi, functionName: "balanceOf", args: [account] }),
              client.readContract({ address: addr, abi: seriesAbi, functionName: "claimable", args: [account] }),
              client.readContract({ address: row.token.address, abi: erc20Abi, functionName: "allowance", args: [account, addr] }),
            ]);
            Object.assign(me, { p, y, claimable, allowance });
          }
          return { ...row, address: addr, pToken, yToken, settled, multiplier, locked, yieldRaw: owed + pending, me };
        }),
      );
    },
  });
}

export function maturityLabel(ts: number, style: "short" | "long" = "short"): string {
  return new Date(ts * 1000).toLocaleDateString("en-GB", style === "short" ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function daysTo(ts: number, now: number): number {
  return Math.max(0, Math.ceil((ts - now) / 86_400));
}
