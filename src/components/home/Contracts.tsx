"use client";

import { EXPLORER_URL, FACTORY_ADDRESS, IS_MAINNET } from "@/config/network";
import { useSeries } from "@/lib/series";

function Row({ label, address }: { label: string; address: string | null }) {
  return (
    <div className="row">
      <span>{label}</span>
      <span>{address ?? "Set at deployment"}</span>
      {address ? (
        <a href={`${EXPLORER_URL}/address/${address}`} target="_blank" rel="noopener noreferrer">
          Blockscout
        </a>
      ) : (
        <span />
      )}
    </div>
  );
}

export function Contracts() {
  const { data } = useSeries();
  return (
    <div className="code">
      <div className="h">Contracts · {IS_MAINNET ? "Robinhood Chain 4663" : "local chain"}</div>
      <Row label="SeriesFactory" address={FACTORY_ADDRESS} />
      {(data ?? []).map((r) => (
        <Row key={r.key} label={`${r.token.symbol} series`} address={r.address} />
      ))}
    </div>
  );
}
