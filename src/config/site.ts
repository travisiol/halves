import protocol from "./protocol.json";

/** The brand, in one place. */
export const site = {
  name: "HALVES",
  hook: "Split a stock token into the stock and its dividends.",
  description:
    "Split a Robinhood Stock Token into a principal token and a yield token. Keep one half, trade the other, merge back any time.",
  url: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://halveshq.fun",
  x: "https://x.com/halveshq",
  xHandle: "@halveshq",
} as const;

/** The contract's constants (a contract test fails if these differ from SeriesFactory.sol). */
export const PROTOCOL = {
  defaultMaturity: protocol.defaultMaturity,
  splitFeeBps: protocol.splitFeeBps,
  mergeFeeBps: protocol.mergeFeeBps,
} as const;

/** The four series the site offers, all verified Robinhood Stock Tokens (see tokens.ts). */
export const OFFERED = ["SPY", "NVDA", "AAPL", "TSLA"] as const;
