import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { DocContracts } from "@/components/DocContracts";
import { IS_MAINNET } from "@/config/network";
import { PROTOCOL, site } from "@/config/site";

export const metadata: Metadata = { title: "Docs" };

const MATURITY = new Date(PROTOCOL.defaultMaturity * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function Docs() {
  return (
    <div className="doc">
      <nav>
        <div className="nav-in">
          <Brand size={24} />
          <div className="nav-right" style={{ gap: 22 }}>
            <div className="nav-links">
              <Link href="/docs" className="on">
                Docs
              </Link>
              <a href={site.x} target="_blank" rel="noopener noreferrer">
                X
              </a>
            </div>
            <Link className="btn acc" href="/app">
              Open the app
            </Link>
          </div>
        </div>
      </nav>

      <header className="doc wrap">
        <h1>How {site.name} works.</h1>
        <p className="sub">{site.name} splits a tokenized stock into two things you can hold or trade separately: the share itself, and the dividends it earns. This page is the whole mechanism, plainly.</p>
      </header>

      <div className="wrap">
        <section id="what">
          <h2>
            <span className="n">01</span>The split
          </h2>
          <p>
            Robinhood Chain Stock Tokens do not pay cash dividends. When the underlying company pays one, it is reinvested and the token&apos;s on-chain multiplier (<b>uiMultiplier</b>, ERC-8056) rises: the raw balance stays the same, but each token stands for more of the share. That growth is a yield stream, and {site.name} splits it off.
          </p>
          <p>Deposit a Stock Token into a series (one stock × one maturity) and {site.name} mints two ERC-20s, counted in shares:</p>
          <ul>
            <li>
              <b style={{ color: "var(--blue)" }}>pX</b> (<b>pSPY</b>) — the share without its dividends. At maturity it redeems its part of the stock tokens owed to principal: one share per pSPY at the multiplier of that day.
            </li>
            <li>
              <b className="g">yX</b> (<b>ySPY</b>) — every dividend the deposited shares earn until maturity, and nothing else. It is credited in the stock token, claimable any time, pro rata to the ySPY you hold. No leverage, no liquidation: the worst case is that it earns nothing.
            </li>
          </ul>
          <p>
            <b>Merge is the anchor:</b> one pX plus one yX always returns one share of the stock token, for free, at any time — before and after maturity. Yield already credited to you stays claimable after you merge.
          </p>
          <p>
            <b>&quot;Do I have to claim dividends on my stock token?&quot;</b> No. On Robinhood Chain a dividend is reinvested automatically inside every holder&apos;s tokens through the multiplier. {site.name} does not create dividends; it lets you separate the part that comes from them and hold or sell it on its own. Be careful with any site offering to &quot;claim&quot; stock-token dividends for you: there is no such mechanism.
          </p>
        </section>

        <section id="lineage">
          <h2>
            <span className="n">02</span>Where this comes from
          </h2>
          <p>Separating an asset from its income is one of the oldest trades in fixed income and equities. {site.name} rebuilds it on tokenized stocks.</p>
          <ul>
            <li>
              <b>Treasury STRIPS (1985–today).</b> Dealers separate a Treasury bond into its principal and its coupons, and each piece trades alone. The principal-only piece trades at a discount and redeems at par. <b style={{ color: "var(--blue)" }}>pX is the same idea</b> applied to a share.
            </li>
            <li>
              <b>PRIMES &amp; SCORES (1983–1992).</b> The Americus Trusts took blue-chip shares and issued two listed claims on them: one carried the dividends, the other the price appreciation, and the two could be put back together into the share. Tax changes in 1986 ended new trusts; the existing ones ran off by 1992.
            </li>
            <li>
              <b>Dividend futures and swaps (2008–today).</b> Institutions trade the realised dividends of an index or a stock over a fixed term on Eurex and CME. Retail investors rarely get access. <b className="g">yX is that exposure as an ERC-20.</b>
            </li>
          </ul>
          <p>
            What changes here is the rails: both halves are ERC-20s, the split is self-service, the accounting is on chain, and <b>pX + yX merge back into the stock token at par, free, at any time.</b>
          </p>
        </section>

        <section id="math">
          <h2>
            <span className="n">03</span>The math
          </h2>
          <p>
            Let <b>m</b> be the stock token&apos;s multiplier (1 for a token without one) and <b>S</b> the pX supply in shares. The raw stock tokens owed to principal are <b>S / m</b>. Everything the series holds above that, minus the yield already credited, is new yield.
          </p>
          <div className="math">
            <span className="c">{"// split(s): always mints at par, rounding in the series' favour"}</span>
            {"\n"}pulls ceil(s / m) {"   "}SPY{"  →  "}s pSPY + s ySPY{"\n\n"}
            <span className="c">{"// merge(s), before maturity"}</span>
            {"\n"}burns s pSPY + s ySPY{"  →  "}floor(s / m) SPY{"\n\n"}
            <span className="c">{"// yield, on every interaction"}</span>
            {"\n"}new = balance − S / m − credited{"\n"}
            <span className="g">{"each ySPY earns new / total ySPY, paid in SPY"}</span>
            {"\n\n"}
            <span className="c">{"// at maturity, per pSPY"}</span>
            {"\n"}redeems (balance − credited yield) / S
          </div>
          <p>Because the series credits only what it holds above the principal owed, it is always fully backed: principal is paid first, yield only from the excess. A fall in the multiplier or the balance stops new yield until the excess is back, and claims are capped so they never take what principal is owed.</p>
        </section>

        <section id="fees">
          <h2>
            <span className="n">04</span>Fees
          </h2>
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Fee</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>split</td>
                <td>{PROTOCOL.splitFeeBps}</td>
                <td>the full deposit becomes pX + yX</td>
              </tr>
              <tr>
                <td>merge</td>
                <td>{PROTOCOL.mergeFeeBps}</td>
                <td>free, always — the free exit keeps the halves honest</td>
              </tr>
              <tr>
                <td>claim yield</td>
                <td>0</td>
                <td>paid in the stock token</td>
              </tr>
              <tr>
                <td>redeem pX</td>
                <td>0</td>
                <td>from maturity on</td>
              </tr>
            </tbody>
          </table>
          <p>There is no fee anywhere in the contracts and no fee switch: they have no owner. You pay only the network&apos;s gas.</p>
        </section>

        <section id="pools">
          <h2>
            <span className="n">05</span>The pools
          </h2>
          <p>pX and yX are plain ERC-20s, so anyone can open a Uniswap pool for them on Robinhood Chain. {site.name} does not seed or run pools.</p>
          <ul>
            <li>
              <b>Fixed rate.</b> When a pX pool is quoted in the stock token itself, the site reads its price from GeckoTerminal and shows the implied rate: buying one pSPY at 0.97 SPY and redeeming one share at maturity is a 3% discount, annualised to the days left.
            </li>
            <li>
              <b>No pool, no rate.</b> Until a pool exists the site says &quot;No pool yet&quot; and shows no rate.
            </li>
            <li>
              <b className="g">Merge keeps the sum near one share.</b> If pX + yX trade above one share in pools, splitting and selling closes the gap; below it, buying both and merging does.
            </li>
          </ul>
        </section>

        <section id="classification">
          <h2>
            <span className="n">06</span>Dividends vs stock splits
          </h2>
          <p>The multiplier can also move for a stock split of the underlying company, which adds no value. A series cannot tell the two apart: it reads only the multiplier and its own balance.</p>
          <ul>
            <li>If the multiplier rises because of a stock split, the series counts the change as yield, and value moves from pX holders to yX holders.</li>
            <li>If the multiplier falls, new yield stops until it recovers, and claims never take what principal is owed.</li>
          </ul>
          <p className="note">Before holding pX through an announced corporate action of the underlying company, check it. You can always merge back to the stock token, free, if you hold both halves.</p>
        </section>

        <section id="lifecycle">
          <h2>
            <span className="n">07</span>Lifecycle
          </h2>
          <p>
            A series runs <b>OPEN → SETTLED</b>. While open: split, merge, claim. The default maturity is <b>{MATURITY}, 00:00 UTC</b>; the factory lets whoever opens a series choose another. From maturity on, the first call — or anyone calling <b>settle()</b> — credits the last yield and freezes the series. After that, split is closed; pX redeems its part of everything not owed to yield, yX claims what it was credited and is burnt by <b>redeemYield()</b>, and merge keeps working.
          </p>
        </section>

        <section id="risks">
          <h2>
            <span className="n">08</span>Risks, plainly
          </h2>
          <ul>
            <li>
              <b>Price.</b> Both halves follow the stock. pX loses value when the share falls; yX is worth only the dividends paid before maturity.
            </li>
            <li>
              <b>Stock splits and corporate actions</b> are read as yield (section 06).
            </li>
            <li>
              <b>No review.</b> The contracts have tests but no third-party security review. Use amounts you can afford to lose.
            </li>
            <li>
              <b>The stock token.</b> {site.name} depends on Robinhood Stock Tokens and their issuer. If the token stops working or is frozen, so does the series.
            </li>
            <li>
              <b>Pools.</b> Prices in pools can be thin and far from fair value.
            </li>
          </ul>
        </section>

        <section id="contracts">
          <h2>
            <span className="n">09</span>Contracts
          </h2>
          <p>{IS_MAINNET ? "Robinhood Chain, chain id 4663." : "Local chain."} Addresses appear here once the factory is deployed and each series is opened.</p>
          <DocContracts />
          <h3 style={{ marginTop: 22 }}>Licence</h3>
          <p>
            The contracts are published under the MIT licence: <b>SeriesFactory</b>, <b>Series</b> and <b>HalfToken</b>.
          </p>
        </section>
      </div>

      <footer>
        <div className="wrap">
          <span>{site.name} · {IS_MAINNET ? "Robinhood Chain 4663" : "local chain"} · merge is free, always</span>
          <span>
            <Link href="/branding">brand kit</Link> ·{" "}
            <a href={site.x} target="_blank" rel="noopener noreferrer">
              X
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
