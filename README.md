# HALVES

- **Name**: HALVES (in `src/config/site.ts`, `package.json`). X `@halveshq`, domain placeholder `halveshq.fun`.
- **Hook**: Split a stock token into the stock and its dividends.
- **Design**: a 1:1 rebuild of the source site's design (dark `#0A0C0B`, mint `#3CE3A7`, Archivo + Geist Mono + Silkscreen; light app theme under `prefers-color-scheme: light`). The source's own CSS blocks are in `src/app/globals.css`, scoped `.home`, `.doc`, `.appx`. Logo: `brand/logo-1024.png` → `public/logo-*.png`.

## Mechanic (contracts/)

`SeriesFactory.createSeries(stock, maturity)` (maturity 0 → `DEFAULT_MATURITY` = 2027-12-31 00:00 UTC) deploys a `Series` with two ERC-20s, `pX` and `yX`. No owner, no fee, no admin.

- Amounts are **shares**: raw × `uiMultiplier()/1e18` for ERC-8056 tokens (detected at creation with a try/catch call), raw for others.
- `split(s)`: pulls ceil(s/m) raw, mints s pX + s yX. Fee-on-transfer tokens are refused.
- `merge(s)`: burns s of both, returns floor(s/m) raw, any time (after maturity: pro-rata principal).
- Yield = vault balance − pX supply / m − yield already credited. Credited to yX pro rata through an accumulator; yX transfers checkpoint both sides. `claimYield()` is capped so it never takes what principal is owed. A balance or multiplier drop stops new yield until recovered.
- From `maturity`, the first call (or `settle()`) credits the last yield and freezes: `redeemPrincipal(s)` pays (balance − owed yield) × s / pX supply; `redeemYield()` claims and burns yX.
- Known limit: a stock split of the underlying that raises `uiMultiplier` is read as yield (documented in /docs §06).

`npm test` (10 tests). Local play: `npm --prefix contracts run node` (8905), then `PHASE=deploy|multiplier|lifecycle npx hardhat run scripts/play-local.ts --network localhost`, and `scripts/play-ui.mjs` against a build made with the local env (see `.env.example`; `NEXT_DIST_DIR=.next-local` keeps it apart from the production build).

## Pages

`/` (hero with the scroll/click split, fixed-rate cards read from GeckoTerminal when a pX pool exists, app doors, steps, contracts, cards, footer), `/app` (connect screen, Your money, Markets, a page per series `#/market/spy`, `#/split`, `#/merge`), `/docs`, `/branding`. Chain reads go through `/api/rpc`; pools through `/api/pool`.

## Owner to-do

Deploy `SeriesFactory`, open the four series (SPY, NVDA, AAPL, TSLA at the default maturity), set `NEXT_PUBLIC_FACTORY_ADDRESS` in Vercel. No third-party review of the contracts exists.
