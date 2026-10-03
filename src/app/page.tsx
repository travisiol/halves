import Link from "next/link";
import { Brand } from "@/components/Brand";
import { Contracts } from "@/components/home/Contracts";
import { Hero } from "@/components/home/Hero";
import { Rates } from "@/components/home/Rates";
import { IS_MAINNET } from "@/config/network";
import { OFFERED, site } from "@/config/site";

const TICKERS = [...OFFERED];
const shot = (img: string) => ({ ["--img" as string]: `url(${img})` }) as React.CSSProperties;

export default function Home() {
  return (
    <div className="home">
      <nav>
        <div className="nav-in">
          <Brand />
          <div className="nav-r">
            <div className="links">
              <Link href="/docs">Docs</Link>
              <a href={site.x} target="_blank" rel="noopener noreferrer">
                X
              </a>
            </div>
            <Link className="btn p" href="/app">
              Open the app
            </Link>
          </div>
        </div>
      </nav>

      <Hero tickers={TICKERS} />

      <div className="after">
        <section className="sec strip">
          <div className="wrap">
            <h2>Fixed rates, read from the pools.</h2>
            <p className="sub">Buy the principal token under par, redeem it for the whole share at maturity. The discount is your rate.</p>
            <Rates />
            <div className="note">
              <i />
              Read from each principal token&apos;s pool when one exists. The rate is the discount to one share, annualised to maturity.
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <h2>One app, start to finish.</h2>
            <p className="sub">Your money, every market and the split box on one screen. One wallet, no account.</p>
            <div className="cards">
              <div className="card">
                <div className="t">
                  <b>Your money</b>
                  <p>What you hold in each series, the yield waiting for you, and four doors: split, merge, claim, redeem.</p>
                  <Link href="/app">Open the app →</Link>
                </div>
                <div className="shot" style={shot("/img/overview.png")} />
              </div>
              <div className="card">
                <div className="t">
                  <b>Markets</b>
                  <p>Every series in one table. Open one for its numbers and a split box that quotes as you type.</p>
                  <Link href="/app#/market/spy">See a market →</Link>
                </div>
                <div className="shot" style={shot("/img/market.png")} />
              </div>
              <div className="card">
                <div className="t">
                  <b>Split and merge</b>
                  <p>Pick a stock token, type an amount, see both halves before your wallet opens. Merge back the same way.</p>
                  <Link href="/app#/split">Split a stock →</Link>
                </div>
                <div className="shot" style={shot("/img/split.png")} />
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="how">
          <div className="wrap">
            <h2>How it works</h2>
            <p className="sub">A stock token pays its dividends by growing what each token is worth. {site.name} splits that growth off into its own token.</p>
            <div className="steps">
              <div className="step">
                <div className="k">01 · Split</div>
                <b>One share in, two tokens out</b>
                <p>
                  <span className="tok">
                    <i>SPDR</i>SPY
                  </span>
                  becomes{" "}
                  <span className="tok pt">
                    <i>SPDR</i>pSPY
                  </span>
                  the share, redeemable at maturity, and{" "}
                  <span className="tok yt">
                    <i>SPDR</i>ySPY
                  </span>
                  every dividend until then.
                </p>
              </div>
              <div className="step">
                <div className="k">02 · Trade</div>
                <b>Keep one half, sell the other</b>
                <p>Keep the share without its dividends, or hold only the dividends. Once a pool exists, buying the principal under par locks a fixed rate.</p>
              </div>
              <div className="step">
                <div className="k">03 · Merge</div>
                <b>Back to the stock, any time</b>
                <p>Hold both halves and merge them back into the stock token whenever you want. No fee, no lockup, no maturity to wait for.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <h2>Open by default. Readable on chain.</h2>
            <p className="sub">Every series is a plain contract on Robinhood Chain. Read it yourself before you use it.</p>
            <div className="trust">
              <Contracts />
              <div className="tcol">
                <div className="tc">
                  <b>No owner</b>
                  <p>The factory and every series have no admin, no pause and no fee switch. Anyone can open a series; nobody can change one.</p>
                </div>
                <div className="tc">
                  <b>Noncustodial</b>
                  <p>Your halves sit in your wallet. A series only holds the stock tokens backing them, and pays them back on merge or at maturity.</p>
                </div>
                <div className="tc">
                  <b>Merge is free, always</b>
                  <p>
                    Both halves together return the stock token at any time, before or after maturity. <Link href="/docs">Read the rules.</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="cta">
          <div className="wrap">
            <h2>Start with one share.</h2>
            <p>Connect a wallet that holds a Robinhood Stock Token, split it, and keep the half you want.</p>
            <div className="ctas">
              <Link className="btn p lg" href="/app">
                Open the app
              </Link>
              <Link className="btn lg" href="/docs">
                Read the docs
              </Link>
            </div>
          </div>
        </section>

        <footer>
          <div className="wrap">
            <div className="row">
              <span>
                <b style={{ fontFamily: "var(--pixel)", letterSpacing: ".14em", color: "var(--t1)" }}>{site.name}</b> · {IS_MAINNET ? "Robinhood Chain 4663" : "local chain"} · merge is free · not investment advice
              </span>
              <span className="l">
                <Link href="/app">App</Link>
                <Link href="/docs">Docs</Link>
                <Link href="/branding">Brand</Link>
                <a href={site.x} target="_blank" rel="noopener noreferrer">
                  X
                </a>
              </span>
            </div>
            <p>{site.name} works on top of Robinhood Stock Tokens issued by Robinhood Assets (Jersey) Ltd. A yield token is a claim on the growth of the stock tokens held by its series, not on the underlying equity.</p>
            <p>Not investment advice. Both halves can lose value. Not available where Robinhood Stock Tokens are not available.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
