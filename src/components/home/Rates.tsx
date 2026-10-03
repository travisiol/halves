"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { fixedRate, usePool } from "@/lib/pool";
import { maturityLabel, useSeries, type SeriesRow } from "@/lib/series";

const nowSec = () => Math.floor(Date.now() / 60_000) * 60;
const useNow = () => useSyncExternalStore(() => () => {}, nowSec, () => 0);

function RateCard({ row }: { row: SeriesRow }) {
  const now = useNow();
  const pool = usePool(row.pToken);
  const rate = fixedRate(pool.data, row.token.address, row.maturity, now);
  return (
    <Link className="stat" href={`/app#/market/${row.key}`}>
      <div className="n">
        {rate === null ? <small className="ns">No pool yet</small> : `${(rate * 100).toFixed(2)}%`}
        <small>p{row.token.symbol}</small>
      </div>
      <div className="l">{rate === null ? `Principal to ${maturityLabel(row.maturity)}` : `Fixed to ${maturityLabel(row.maturity)}`}</div>
    </Link>
  );
}

export function Rates() {
  const { data } = useSeries();
  return (
    <div className="in" id="rates">
      {(data ?? []).map((row) => (
        <RateCard key={row.key} row={row} />
      ))}
    </div>
  );
}
