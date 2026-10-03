import { NextResponse } from "next/server";
import { isAddress } from "viem";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * The deepest GeckoTerminal pool (network `robinhood`) for a principal token, with the price of one
 * principal token in the other side of the pool. `{ pool: null }` when none exists.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!isAddress(token)) return NextResponse.json({ pool: null });
  try {
    const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/${token}/pools?page=1`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ pool: null });
    const j = (await res.json()) as { data?: { attributes: Record<string, string>; relationships: { base_token: { data: { id: string } }; quote_token: { data: { id: string } } } }[] };
    const p = j.data?.[0];
    if (!p) return NextResponse.json({ pool: null });
    const base = p.relationships.base_token.data.id.split("_").pop()?.toLowerCase();
    const quote = p.relationships.quote_token.data.id.split("_").pop()?.toLowerCase();
    const isBase = base === token.toLowerCase();
    const price = Number(isBase ? p.attributes.base_token_price_quote_token : p.attributes.quote_token_price_base_token);
    return NextResponse.json({
      pool: {
        address: p.attributes.address,
        name: p.attributes.name,
        other: isBase ? quote : base,
        price: Number.isFinite(price) ? price : null,
        url: `https://www.geckoterminal.com/robinhood/pools/${p.attributes.address}`,
      },
    });
  } catch {
    return NextResponse.json({ pool: null });
  }
}
