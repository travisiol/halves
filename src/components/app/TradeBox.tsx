"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { PROTOCOL } from "@/config/site";
import { erc20Abi, seriesAbi } from "@/lib/abi";
import { fmt } from "@/lib/format";
import { maturityLabel, type SeriesRow } from "@/lib/series";
import { errorText, useWallet } from "@/lib/tx";

type Mode = "split" | "merge" | "redeem";

const ONE = 10n ** 18n;

function parse(v: string, dec: number): bigint {
  try {
    return v.trim() ? parseUnits(v.trim(), dec) : 0n;
  } catch {
    return 0n;
  }
}

/** The split / merge / redeem box. Quotes as you type; shows both sides before the wallet opens. */
export function TradeBox({ row, initial = "split" }: { row: SeriesRow; initial?: Mode }) {
  const [mode, setMode] = useState<Mode>(row.settled ? "redeem" : initial);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<{ text: string; tone?: "ok" | "bad" } | null>(null);
  const { address, ready, send, busy } = useWallet();
  const qc = useQueryClient();
  const sym = row.token.symbol;
  const dec = row.token.decimals;
  const shares = parse(value, dec);
  const m = row.multiplier || ONE;
  const rawIn = shares === 0n ? 0n : (shares * ONE + m - 1n) / m; // what split pulls, rounded up
  const rawOut = (shares * ONE) / m; // what merge returns before maturity, rounded down
  const stockShares = (row.me.stock * m) / ONE;
  const max = mode === "split" ? stockShares : mode === "merge" ? (row.me.p < row.me.y ? row.me.p : row.me.y) : row.me.p;
  const over = shares > max && address !== undefined;

  const setPart = (num: bigint, den: bigint) => setValue(max === 0n ? "" : formatUnits((max * num) / den, dec));

  const refresh = () => qc.invalidateQueries({ queryKey: ["series"] });

  async function run() {
    setStatus(null);
    const acct = await ready();
    if (!acct) return;
    if (!row.address) {
      setStatus({ text: `The ${sym} series opens on this page once its contract address is published.` });
      return;
    }
    if (shares === 0n) {
      setStatus({ text: "Type an amount first." });
      return;
    }
    try {
      if (mode === "split") {
        if (row.me.allowance < rawIn) {
          await send("approve", { address: row.token.address, abi: erc20Abi, functionName: "approve", args: [row.address, rawIn] });
        }
        await send("split", { address: row.address, abi: seriesAbi, functionName: "split", args: [shares] });
        setStatus({ text: `Split done: ${fmt(shares, dec)} p${sym} and ${fmt(shares, dec)} y${sym} are in your wallet.`, tone: "ok" });
      } else if (mode === "merge") {
        await send("merge", { address: row.address, abi: seriesAbi, functionName: "merge", args: [shares] });
        setStatus({ text: `Merged: ${sym} is back in your wallet.`, tone: "ok" });
      } else {
        await send("redeem", { address: row.address, abi: seriesAbi, functionName: "redeemPrincipal", args: [shares] });
        setStatus({ text: `Redeemed ${fmt(shares, dec)} p${sym}.`, tone: "ok" });
      }
      setValue("");
    } catch (e) {
      setStatus({ text: errorText(e), tone: "bad" });
    } finally {
      refresh();
    }
  }

  async function claim() {
    setStatus(null);
    const acct = await ready();
    if (!acct || !row.address) return;
    try {
      await send("claim", { address: row.address, abi: seriesAbi, functionName: row.settled ? "redeemYield" : "claimYield" });
      setStatus({ text: `Yield claimed in ${sym}.`, tone: "ok" });
    } catch (e) {
      setStatus({ text: errorText(e), tone: "bad" });
    } finally {
      refresh();
    }
  }

  const label = !address
    ? "Connect a wallet"
    : busy === "approve"
      ? `Approving ${sym}…`
      : busy === mode
        ? mode === "split"
          ? "Splitting…"
          : mode === "merge"
            ? "Merging…"
            : "Redeeming…"
        : mode === "split"
          ? row.me.allowance < rawIn && row.address
            ? `Approve and split ${sym}`
            : `Split ${sym}`
          : mode === "merge"
            ? `Merge into ${sym}`
            : `Redeem p${sym}`;

  return (
    <div className="tbox" id="ticket">
      <div className="stabs" role="tablist">
        {(row.settled ? (["redeem", "merge"] as Mode[]) : (["split", "merge"] as Mode[])).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={mode === x} className={mode === x ? "on" : ""} onClick={() => { setMode(x); setValue(""); setStatus(null); }}>
            {x === "split" ? "Split" : x === "merge" ? "Merge" : "Redeem"}
          </button>
        ))}
      </div>
      <label className="amt">
        <div className="v">
          <input inputMode="decimal" placeholder="0" value={value} aria-label="Amount" onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))} style={{ width: `${Math.max(1, value.length)}ch` }} />
          <span className="post">{mode === "split" ? sym : `p${sym}`}</span>
        </div>
        <div className="h">{address ? `You have ${fmt(max, dec)} ${mode === "split" ? sym : mode === "merge" ? `p${sym} + y${sym}` : `p${sym}`}` : "Amount in shares"}</div>
      </label>
      <div className="quick">
        <button type="button" onClick={() => setPart(1n, 4n)}>25%</button>
        <button type="button" onClick={() => setPart(1n, 2n)}>50%</button>
        <button type="button" onClick={() => setPart(1n, 1n)}>Max</button>
      </div>
      <div className="sum" style={{ marginTop: 12 }}>
        {mode === "split" ? (
          <>
            <div className="l"><span className="k">You give</span><b>{fmt(shares, dec)} {sym}</b></div>
            <div className="l"><span className="k">You receive</span><b>{fmt(shares, dec)} p{sym} + {fmt(shares, dec)} y{sym}</b></div>
            <div className="l"><span className="k">Tokens moved</span><b>{fmt(rawIn, dec, 6)} {sym}</b></div>
          </>
        ) : mode === "merge" ? (
          <>
            <div className="l"><span className="k">You give</span><b>{fmt(shares, dec)} p{sym} + {fmt(shares, dec)} y{sym}</b></div>
            <div className="l"><span className="k">You receive</span><b>{row.settled ? `your part of the principal, in ${sym}` : `${fmt(shares, dec)} ${sym}`}</b></div>
            <div className="l"><span className="k">Tokens moved</span><b>{row.settled ? "set at redemption" : `${fmt(rawOut, dec, 6)} ${sym}`}</b></div>
          </>
        ) : (
          <>
            <div className="l"><span className="k">You give</span><b>{fmt(shares, dec)} p{sym}</b></div>
            <div className="l"><span className="k">You receive</span><b>your part of the principal, in {sym}</b></div>
          </>
        )}
        <div className="l"><span className="k">Fee</span><b>{(mode === "split" ? PROTOCOL.splitFeeBps : PROTOCOL.mergeFeeBps) === 0 ? "Free" : `${(mode === "split" ? PROTOCOL.splitFeeBps : PROTOCOL.mergeFeeBps) / 100}%`}</b></div>
        <div className="l"><span className="k">Maturity</span><b>{maturityLabel(row.maturity, "long")}</b></div>
      </div>
      {over ? <div className="warn">That is more than you hold.</div> : null}
      <button type="button" className="btnp" style={{ marginTop: 12 }} disabled={Boolean(busy) || over} onClick={run}>
        {label}
      </button>
      {row.me.claimable > 0n || row.me.y > 0n ? (
        <button type="button" className="btns" disabled={Boolean(busy) || row.me.claimable === 0n} onClick={claim}>
          {busy === "claim" ? "Claiming…" : `Claim ${fmt(row.me.claimable, dec, 6)} ${sym} of yield`}
        </button>
      ) : null}
      <div className={`status ${status?.tone ?? ""}`} role="status">
        {status?.text ?? ""}
      </div>
    </div>
  );
}
