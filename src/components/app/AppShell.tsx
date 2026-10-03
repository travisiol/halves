"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useConnection, useDisconnect } from "wagmi";
import { openConnect, useAccountLabel } from "@/components/wallet/ConnectButton";
import { H_CELLS } from "@/components/home/Hero";
import { IS_MAINNET } from "@/config/network";
import { PROTOCOL, site } from "@/config/site";
import { fmt } from "@/lib/format";
import { useHashRoute, useMounted } from "@/lib/hooks";
import { fixedRate, usePool } from "@/lib/pool";
import { daysTo, maturityLabel, useSeries, type SeriesRow } from "@/lib/series";
import { TradeBox } from "./TradeBox";

const ONE = 10n ** 18n;
const nowSec = () => Math.floor(Date.now() / 60_000) * 60;
const useNow = () => useSyncExternalStore(() => () => {}, nowSec, () => PROTOCOL.defaultMaturity - 365 * 86_400);

// "Just looking" is remembered per browser; storage may be blocked, so every access is guarded.
const BROWSE_KEY = "halves:browse";
const browseListeners = new Set<() => void>();
function readBrowse(): boolean {
  try {
    return localStorage.getItem(BROWSE_KEY) === "1";
  } catch {
    return false;
  }
}
function setBrowse() {
  try {
    localStorage.setItem(BROWSE_KEY, "1");
  } catch {}
  browseListeners.forEach((l) => l());
}
const useBrowse = () =>
  useSyncExternalStore(
    (l) => {
      browseListeners.add(l);
      return () => browseListeners.delete(l);
    },
    readBrowse,
    () => false,
  );

function Mark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="-2 -2 94 144" className={className} style={style} aria-hidden="true">
      {H_CELLS.map(([c, r, g]) => (
        <rect key={`${c}-${r}`} x={1.2 + c * 10} y={1.2 + r * 10} width="7.6" height="7.6" fill={g ? "var(--acc)" : "var(--s3)"} />
      ))}
    </svg>
  );
}

function BrandSmall() {
  return (
    <Link className="brand" href="/">
      <Image src="/logo-128.png" alt="" width={24} height={24} style={{ borderRadius: 6 }} />
      <span className="word">{site.name}</span>
    </Link>
  );
}

/* ── the first screen: connect or browse, as in the source's login screen ── */
function Gate({ rows }: { rows: SeriesRow[] }) {
  const open = rows.filter((r) => r.address).length;
  return (
    <div className="login">
      <div className="l">
        <BrandSmall />
        <div className="mid">
          <h1>Your stocks, in two halves.</h1>
          <p className="sub">Split a stock token into the share and its dividends, keep the half you want, merge back whenever you like. Plain English, one screen at a time.</p>
        </div>
        <div className="rates">
          <div>
            Series
            <em>{open} of {rows.length}</em>
          </div>
          <div>
            Matures
            <em>{maturityLabel(PROTOCOL.defaultMaturity)}</em>
          </div>
          <div>
            Split fee
            <em>{PROTOCOL.splitFeeBps / 100}%</em>
          </div>
          <div>
            Merge fee
            <em>{PROTOCOL.mergeFeeBps / 100}%</em>
          </div>
        </div>
      </div>
      <div className="r" style={{ position: "relative", overflow: "hidden" }}>
        <Mark style={{ position: "absolute", right: 16, top: 24, width: 300, opacity: 0.55 }} />
        <div className="card" style={{ position: "relative" }}>
          <h2>Connect</h2>
          <p>Use any browser wallet on Robinhood Chain. Connecting only shares your address.</p>
          <button type="button" className="btnp" onClick={openConnect}>
            Continue with a wallet
          </button>
          <div className="or">or</div>
          <p style={{ textAlign: "center", fontSize: 13.5 }}>Every split, merge and claim is signed in your own wallet. Your halves never leave it.</p>
          <p style={{ textAlign: "center", fontSize: 13.5 }}>By continuing you agree this is not investment advice. Both halves can lose value.</p>
          <button type="button" className="btns" onClick={setBrowse}>
            Just looking? Browse without a wallet
          </button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ k, v, f }: { k: string; v: string; f: string }) {
  return (
    <div className="kpi">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      <div className="f">{f}</div>
    </div>
  );
}

function RateCell({ row }: { row: SeriesRow }) {
  const now = useNow();
  const pool = usePool(row.pToken);
  const r = fixedRate(pool.data, row.token.address, row.maturity, now);
  if (r !== null) return <span className="n g">{(r * 100).toFixed(2)}%</span>;
  if (pool.data) {
    return (
      <a className="n" href={pool.data.url} target="_blank" rel="noopener noreferrer">
        Pool
      </a>
    );
  }
  return <span className="n" style={{ color: "var(--t3)" }}>No pool yet</span>;
}

/* ── views ── */
function Overview({ rows }: { rows: SeriesRow[] }) {
  const held = rows.reduce((a, r) => a + (r.me.stock * r.multiplier) / ONE, 0n);
  const principal = rows.reduce((a, r) => a + r.me.p, 0n);
  const yieldT = rows.reduce((a, r) => a + r.me.y, 0n);
  const claim = rows.reduce((a, r) => a + r.me.claimable, 0n);
  const mine = rows.filter((r) => r.me.p > 0n || r.me.y > 0n || r.me.claimable > 0n);
  return (
    <>
      <div className="hero">
        <h1>Your money</h1>
        <p>What you hold in each series and what it has earned. Pick a door to split, merge, claim or redeem.</p>
      </div>
      <div className="kpis">
        <Kpi k="Stock tokens in wallet" v={fmt(held, 18, 2)} f="shares, across the four stocks" />
        <Kpi k="Principal held" v={fmt(principal, 18, 2)} f="pX, redeems the share at maturity" />
        <Kpi k="Yield tokens held" v={fmt(yieldT, 18, 2)} f="yX, earns every dividend" />
        <Kpi k="Yield to claim" v={fmt(claim, 18, 4)} f="in stock tokens" />
      </div>
      <div className="doors">
        <a className="door" href="#/split">
          <span className="ico">01</span>
          <b>Split a stock</b>
          <span>One stock token in, a principal and a yield token out.</span>
        </a>
        <a className="door" href="#/merge">
          <span className="ico">02</span>
          <b>Merge back</b>
          <span>Both halves in, the stock token out. Free, any time.</span>
        </a>
        <a className="door" href="#/markets">
          <span className="ico">03</span>
          <b>Claim dividends</b>
          <span>Yield tokens collect each dividend; claim it in the stock.</span>
        </a>
        <a className="door" href="#/markets">
          <span className="ico">04</span>
          <b>Redeem at maturity</b>
          <span>From {maturityLabel(PROTOCOL.defaultMaturity, "long")}, principal pays out the share.</span>
        </a>
      </div>
      <h2 className="sec" style={{ marginTop: 24 }}>
        Your positions
      </h2>
      {mine.length === 0 ? (
        <div className="empty">Nothing split yet. Split a stock token and both halves show up here.</div>
      ) : (
        <div className="rows">
          <div className="row head">
            <span>Series</span>
            <span>Principal</span>
            <span>Yield tokens</span>
            <span>To claim</span>
            <span />
          </div>
          {mine.map((r) => (
            <div className="row" key={r.key}>
              <span>
                <b>{r.token.name}</b>
                <small>
                  <em>p{r.token.symbol}</em>
                  <em>y{r.token.symbol}</em> to {maturityLabel(r.maturity)}
                </small>
              </span>
              <span className="n">{fmt(r.me.p, 18, 4)}</span>
              <span className="n">{fmt(r.me.y, 18, 4)}</span>
              <span className="n g">{fmt(r.me.claimable, 18, 6)}</span>
              <span className="acts">
                <a href={`#/market/${r.key}`}>
                  <button type="button" className="hi">Open</button>
                </a>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Markets({ rows }: { rows: SeriesRow[] }) {
  return (
    <>
      <div className="hero">
        <h1>Markets</h1>
        <p>Every series in one table. Open one for its numbers and a split box that quotes as you type.</p>
      </div>
      <div className="rows">
        <div className="row head">
          <span>Series</span>
          <span>Matures</span>
          <span>Locked</span>
          <span>Fixed rate</span>
          <span />
        </div>
        {rows.map((r) => (
          <div className="row" key={r.key}>
            <span>
              <b>{r.token.name}</b>
              <small>
                <em>{r.token.symbol}</em> → <em>p{r.token.symbol}</em>
                <em>y{r.token.symbol}</em>
              </small>
            </span>
            <span className="n">{maturityLabel(r.maturity)}</span>
            <span className="n">{fmt(r.locked, 18, 2)}</span>
            <RateCell row={r} />
            <span className="acts">
              <a href={`#/market/${r.key}`}>
                <button type="button">Open</button>
              </a>
              <a href={`#/market/${r.key}`}>
                <button type="button" className="hi">Split</button>
              </a>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function Market({ row }: { row: SeriesRow }) {
  const now = useNow();
  const pool = usePool(row.pToken);
  const r = fixedRate(pool.data, row.token.address, row.maturity, now);
  const sym = row.token.symbol;
  return (
    <>
      <div className="hero">
        <h1>
          {row.token.name} · {maturityLabel(row.maturity)}
        </h1>
        <p>
          <b>p{sym}</b> is the share, paid out at maturity. <b>y{sym}</b> is every dividend the share earns until then. Together they merge back into {sym} at any time.
        </p>
      </div>
      <div className="kpis">
        <Kpi k="Locked in the series" v={fmt(row.locked, 18, 2)} f={`${sym} shares split`} />
        <Kpi k="Yield earned so far" v={fmt(row.yieldRaw, 18, 4)} f={`${sym}, for y${sym} holders`} />
        <Kpi k="Fixed rate" v={r === null ? "—" : `${(r * 100).toFixed(2)}%`} f={r === null ? (pool.data ? "pool not priced in the stock" : "No pool yet") : `p${sym} pool`} />
        <Kpi k="Days to maturity" v={String(daysTo(row.maturity, now))} f={maturityLabel(row.maturity, "long")} />
      </div>
      <div className="two">
        <div>
          <b>Your p{sym}</b>
          <div className="n">{fmt(row.me.p, 18, 4)}</div>
          <span>Redeems one {sym} share each at maturity.</span>
        </div>
        <div>
          <b>Your y{sym}</b>
          <div className="n">{fmt(row.me.y, 18, 4)}</div>
          <span>Collects the dividends; {fmt(row.me.claimable, 18, 6)} {sym} to claim now.</span>
        </div>
      </div>
      <div className="details">
        Yield is the growth of the stock tokens held by this series above what principal is owed, credited to y{sym} holders pro rata and paid in {sym}. A drop in the token&apos;s value comes out of yield first, never out of what principal is owed.{" "}
        {row.address ? (
          <a href={`${IS_MAINNET ? "https://robinhoodchain.blockscout.com" : ""}/address/${row.address}`} target="_blank" rel="noopener noreferrer">
            Series contract
          </a>
        ) : (
          <span>Series contract: set at deployment.</span>
        )}
        {pool.data ? (
          <>
            {" "}
            · <a href={pool.data.url} target="_blank" rel="noopener noreferrer">p{sym} pool</a>
          </>
        ) : null}
      </div>
    </>
  );
}

function SplitPage({ rows, pick, mode }: { rows: SeriesRow[]; pick: string; mode: "split" | "merge" }) {
  const row = rows.find((r) => r.key === pick) ?? rows[0];
  if (!row) return null;
  return (
    <div className="narrow">
      <div className="hero">
        <h1>{mode === "split" ? "Split a stock" : "Merge back"}</h1>
        <p>{mode === "split" ? "Pick a stock token and an amount. You see both halves before your wallet opens." : "Both halves in, the stock token out. Free, before or after maturity."}</p>
      </div>
      <div className="stock" style={{ marginBottom: 12 }}>
        {rows.map((r) => (
          <a key={r.key} href={`#/${mode}/${r.key}`} style={{ display: "contents" }}>
            <button type="button" className={r.key === row.key ? "on" : ""}>
              <b>{r.token.symbol}</b>
              <span>
                {r.token.name} · <em>{maturityLabel(r.maturity)}</em>
              </span>
            </button>
          </a>
        ))}
      </div>
      <TradeBox key={`${row.key}-${mode}`} row={row} initial={mode} />
    </div>
  );
}

export function AppShell() {
  const mounted = useMounted();
  const route = useHashRoute();
  const browse = useBrowse();
  const { address, isConnected } = useConnection();
  const { mutate: disconnect } = useDisconnect();
  const label = useAccountLabel();
  const { data } = useSeries(isConnected ? address : undefined);
  const rows = data ?? [];
  const parts = route.split("/").filter(Boolean);
  const view = parts[0] ?? "money";
  const market = view === "market" ? rows.find((r) => r.key === parts[1]) : undefined;
  const now = useNow();

  if (mounted && !isConnected && !browse && route === "/") return <div className="appx"><Gate rows={rows} /></div>;

  const crumb = view === "market" && market ? `Markets / ${market.token.symbol} · ${maturityLabel(market.maturity)}` : view === "markets" ? "Markets" : view === "split" ? "Split" : view === "merge" ? "Merge" : "Your money";
  const held = rows.reduce((a, r) => a + r.me.p + r.me.y, 0n);

  return (
    <div className="appx">
      <div className="app">
        <div className="bar">
          <BrandSmall />
          <div className="crumb">
            <b>{crumb}</b>
          </div>
          <div className="right">
            {label ? (
              <button type="button" className="chip me" onClick={() => disconnect()} title="Disconnect">
                {label}
              </button>
            ) : (
              <button type="button" className="chip acc" onClick={openConnect}>
                Connect wallet
              </button>
            )}
          </div>
        </div>
        <div className={market ? "cols" : "cols norail"}>
          <aside className="side">
            <div className="nav">
              <a href="#/" className={view === "money" ? "on" : ""}>
                <i />
                Your money
              </a>
              <a href="#/markets" className={view === "markets" || view === "market" ? "on" : ""}>
                <i />
                Markets
              </a>
              <a href="#/split" className={view === "split" || view === "merge" ? "on" : ""}>
                <i />
                Split &amp; merge
              </a>
              <h2 className="sec">Series · {maturityLabel(PROTOCOL.defaultMaturity)}</h2>
              {rows.map((r) => (
                <a key={r.key} className="rate" href={`#/market/${r.key}`} style={{ padding: "0 4px", color: "var(--t2)" }}>
                  <span>{r.token.symbol}</span>
                  <em className="dim">{daysTo(r.maturity, now)} days</em>
                </a>
              ))}
            </div>
            <button type="button" className="acctbtn" onClick={label ? undefined : openConnect}>
              <span className="r1">
                <span>{label ? "Your halves" : "No wallet connected"}</span>
                <span className="chev">›</span>
              </span>
              <span className="bal">{fmt(held, 18, 2)}</span>
              <small>{label ?? "Connect to see your balances"}</small>
            </button>
            <div className="foot">
              <Link className="fi" href="/">Home</Link>
              <Link className="fi" href="/docs">Docs</Link>
              <a className="fi" href={site.x} target="_blank" rel="noopener noreferrer">X</a>
            </div>
          </aside>
          <main className="main">
            {view === "markets" ? (
              <Markets rows={rows} />
            ) : view === "market" && market ? (
              <Market row={market} />
            ) : view === "split" || view === "merge" ? (
              <SplitPage rows={rows} pick={parts[1] ?? rows[0]?.key ?? "spy"} mode={view} />
            ) : (
              <Overview rows={rows} />
            )}
          </main>
          {market ? (
            <aside className="rail">
              <h2 className="sec">Split and merge {market.token.symbol}</h2>
              <TradeBox key={market.key} row={market} />
            </aside>
          ) : null}
        </div>
        <nav className="tabs" aria-label="Sections">
          <div className="in">
            <a href="#/"><button type="button" className={view === "money" ? "on" : ""}>Your money</button></a>
            <a href="#/markets"><button type="button" className={view === "markets" || view === "market" ? "on" : ""}>Markets</button></a>
            <a href="#/split"><button type="button" className={view === "split" || view === "merge" ? "on" : ""}>Split &amp; merge</button></a>
            <Link href="/docs"><button type="button">Docs</button></Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
