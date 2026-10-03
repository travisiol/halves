"use client";

import { EXPLORER_URL, FACTORY_ADDRESS } from "@/config/network";
import { shortAddress } from "@/lib/format";
import { maturityLabel, useSeries } from "@/lib/series";

function A({ a }: { a: string | null }) {
  if (!a) return <>Set at deployment</>;
  return (
    <a href={`${EXPLORER_URL}/address/${a}`} target="_blank" rel="noopener noreferrer">
      {shortAddress(a)}
    </a>
  );
}

export function DocContracts() {
  const { data } = useSeries();
  return (
    <table>
      <thead>
        <tr>
          <th>Contract</th>
          <th>Address</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>SeriesFactory</td>
          <td>
            <A a={FACTORY_ADDRESS} />
          </td>
        </tr>
        {(data ?? []).map((r) => (
          <tr key={r.key}>
            <td>
              {r.token.symbol}-{maturityLabel(r.maturity).replace(" ", "").toUpperCase()}
            </td>
            <td>
              series <A a={r.address} />
              {r.address ? (
                <>
                  {" "}
                  · p{r.token.symbol} <A a={r.pToken} /> · y{r.token.symbol} <A a={r.yToken} />
                </>
              ) : null}{" "}
              · stock <A a={r.token.address} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
