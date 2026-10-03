"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** The H mark on a 9 × 14 pixel grid: [col, row, green]. The right half is the yield side. */
export const H_CELLS: [number, number, number][] = (() => {
  const cells: [number, number, number][] = [];
  for (let r = 0; r < 14; r++) {
    for (const c of [0, 1, 2]) cells.push([c, r, 0]);
    for (const c of [6, 7, 8]) cells.push([c, r, 1]);
    if (r === 6 || r === 7) for (const c of [3, 4, 5]) cells.push([c, r, c === 5 ? 1 : 0]);
  }
  return cells;
})();

const DISC: Record<string, string> = { SPY: "SPDR", NVDA: "NVDA", AAPL: "AAPL", TSLA: "TSLA" };

/**
 * Port of the source's scroll-driven hero: one token under the headline; scrolling (or a click) drives a seam
 * through it, it cleaves into its principal and yield halves, the other series split into place on two rings,
 * and the H mark lands in the middle. Then the page slides over it.
 */
export function Hero({ tickers }: { tickers: string[] }) {
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const hero = heroRef.current!, c = canvasRef.current!, field = fieldRef.current!;
    const ctx = c.getContext("2d")!;
    const copy = hero.querySelector(".copy") as HTMLElement;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const CELLS = H_CELLS;
    const MW = Math.max(...CELLS.map((x) => x[0])) + 1, MH = Math.max(...CELLS.map((x) => x[1])) + 1;
    let seed = 11;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    const stars = Array.from({ length: 900 }, () => ({ x: rnd(), y: rnd(), a: 0.12 + rnd() * 0.3, g: rnd() < 0.1, c: rnd() < 0.35, s: rnd() < 0.15 ? 3 : 2 }));
    const sky = document.createElement("canvas");
    let skyKey = "";
    const STOCKS = tickers;
    const lg = (t: string) => `<i>${DISC[t] ?? t}</i>`;
    field.innerHTML = `<span class="chip st whole" id="whole" role="button" tabindex="0" aria-label="split ${STOCKS[0]}">${lg(STOCKS[0])}${STOCKS[0]}</span><span class="hint" id="hint2">Click to split</span>`
      + STOCKS.map((t) => `<span class="chip st">${lg(t)}${t}</span><span class="chip pt">${lg(t)}p${t}</span><span class="chip yt">${lg(t)}y${t}</span>`).join("")
      + `<div class="built"><span class="lab">Built on</span><span class="pb"><i style="background:#CCFF00"></i>Robinhood Chain</span></div>`;
    const whole = field.querySelector("#whole") as HTMLElement, hint2 = field.querySelector("#hint2") as HTMLElement;
    const chips = [...field.querySelectorAll<HTMLElement>(".chip:not(.whole)")];
    const ss = (v: number) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    let W = 0, H = 0, dpr = 1, p = 0, full = 0, out = 0, on = false, raf = 0, anim = 0;
    const t0 = performance.now();
    const stage = hero.parentElement!;
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = hero.clientWidth; H = hero.clientHeight; c.width = W * dpr; c.height = H * dpr; c.style.width = W + "px"; c.style.height = H + "px"; };
    const prog = () => {
      const y = -stage.getBoundingClientRect().top, vh = innerHeight;
      p = Math.max(0, Math.min(1, y / vh));
      full = Math.max(0, Math.min(1, (y - vh) / (0.6 * vh)));
      out = Math.max(0, Math.min(1, (y - 1.8 * vh) / (0.8 * vh)));
      const nowOn = p > 0.6;
      if (nowOn !== on) { on = nowOn; hero.classList.toggle("on", on); }
      const fe = ss(Math.min(1, full / 0.4));
      copy.style.opacity = String(1 - fe);
      const built = field.querySelector(".built") as HTMLElement | null;
      if (built) { if (full > 0) built.style.opacity = String(1 - fe); else built.style.removeProperty("opacity"); }
    };
    const draw = (now: number) => {
      const narrow = W < 900, copyBottom = copy.getBoundingClientRect().bottom - hero.getBoundingClientRect().top, region = H - copyBottom;
      const fe = ss(Math.max(0, (full - 0.3) / 0.7)), cy = lerp(copyBottom + region * (narrow ? 0.4 : 0.46), H * 0.5, fe), cx = W / 2;
      field.style.setProperty("--ft", copyBottom + "px");
      const gone = 1 - out;
      c.style.opacity = String(gone); field.style.opacity = String(gone);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const eA = ss((p - 0.1) / 0.35), eB = ss((p - 0.45) / 0.55), split = ss((p - 0.02) / 0.09);
      const key = W + "x" + H + "@" + Math.round(copyBottom);
      if (key !== skyKey) {
        skyKey = key; sky.width = W * dpr; sky.height = H * dpr; const sx = sky.getContext("2d")!; sx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const nStars = Math.min(stars.length, Math.round(W * H / 2600));
        for (const s of stars.slice(0, nStars)) { sx.fillStyle = (s.g ? "rgba(60,227,167," : s.c ? "rgba(190,210,235," : "rgba(242,244,239,") + s.a.toFixed(3) + ")"; sx.fillRect(Math.floor(s.x * W), Math.floor(copyBottom * 0.3 + s.y * (H - copyBottom * 0.3)), s.s, s.s); }
      }
      ctx.drawImage(sky, 0, 0, W, H);
      const big = narrow ? 1.9 : Math.max(2.2, Math.min(3.4, region / 175)), dx = (narrow ? 78 : 62 * big) * eA, seamH = 22 * big + 40 * split;
      const pulse = reduce ? 0.7 : 0.55 + 0.45 * Math.sin(now / 600);
      const seamA = (1 - eB) * (split > 0 ? 0.9 : 0.55 * pulse);
      if (seamA > 0.01) { const g = ctx.createLinearGradient(0, cy - seamH, 0, cy + seamH); g.addColorStop(0, "rgba(60,227,167,0)"); g.addColorStop(0.5, `rgba(60,227,167,${seamA.toFixed(3)})`); g.addColorStop(1, "rgba(60,227,167,0)"); ctx.fillStyle = g; ctx.fillRect(cx - 0.5, cy - seamH, 1.5, seamH * 2); }
      const orx = lerp(narrow ? W * 0.42 : Math.min(W * 0.34, 400), narrow ? W * 0.385 : Math.min(W * 0.42, 640), fe), ory = lerp(region * (narrow ? 0.29 : 0.33), H * (narrow ? 0.34 : 0.37), fe), irx = orx * (narrow ? 0.46 : 0.55), iry = ory * (narrow ? 0.56 : 0.62);
      const kFull = lerp(1, narrow ? 1.12 : 1.3, fe);
      const w = reduce ? 0 : (now - t0) / 42000 * Math.PI * 2, grow = 0.7 + 0.3 * eB, odir = -0.8;
      if (eB > 0.02) {
        ctx.lineWidth = 1;
        for (const [rx, ry] of [[orx, ory], [irx, iry]]) { ctx.beginPath(); ctx.ellipse(cx, cy, rx * grow, ry * grow, 0, 0, Math.PI * 2); ctx.strokeStyle = `rgba(242,244,239,${(0.2 * eB).toFixed(3)})`; ctx.stroke(); }
        const pitch = (narrow ? 4 : 10) * (0.6 + 0.4 * eB) * lerp(1, 1.5, fe), sz = pitch * 0.75, ox = cx - (MW * pitch - (pitch - sz)) / 2, oy = cy - (MH * pitch - (pitch - sz)) / 2;
        for (const [cc, r, g] of CELLS) { ctx.fillStyle = g ? `rgba(60,227,167,${(0.95 * eB).toFixed(3)})` : `rgba(242,244,239,${(0.22 * eB).toFixed(3)})`; ctx.fillRect(ox + cc * pitch, oy + r * pitch, sz, sz); }
      }
      const fy = cy - copyBottom;
      whole.style.transform = `translate(${Math.round(cx)}px,${Math.round(fy)}px) translate(-50%,-50%)`; whole.style.setProperty("--k", big.toFixed(3));
      whole.style.opacity = ((1 - split) * (1 - eB)).toFixed(3); whole.style.pointerEvents = split > 0.3 ? "none" : "auto";
      hint2.style.transform = `translate(${cx}px,${fy + 26 * big + 20}px) translate(-50%,-50%)`; if (split > 0.3) hint2.style.opacity = "0";
      const n = STOCKS.length;
      chips.forEach((el, i) => {
        const k = Math.floor(i / 3), kind = i % 3, home = k * (2 * Math.PI / n) + Math.PI / n;
        const ang = kind === 0 ? home + w : home + w * odir + (kind === 1 ? -0.45 : 0.45), rx = (kind === 0 ? irx : orx) * grow, ry = (kind === 0 ? iry : ory) * grow;
        const ox = cx + Math.cos(ang) * rx, oy = fy + Math.sin(ang) * ry, depth = (Math.sin(ang) + 1) / 2;
        const osc = (kind === 0 ? (narrow ? 0.9 : 0.92) : 1) * (0.5 + 0.5 * eB) * kFull;
        let x = ox, y = oy, sc = osc, op = eB;
        if (k === 0 && kind > 0) {
          const hx = cx + (kind === 1 ? -dx : dx), hy = fy;
          x = lerp(hx, ox, eB); y = lerp(hy, oy, eB); sc = lerp(big, kFull, eB); op = lerp(split, 1, eB);
        }
        sc = Math.round(sc * 44) / 44;
        el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-50%)`;
        if (el.dataset.k !== sc.toFixed(4)) { el.dataset.k = sc.toFixed(4); el.style.setProperty("--k", sc.toFixed(4)); }
        el.style.opacity = op.toFixed(3); el.style.zIndex = String(k === 0 && kind > 0 && eB < 1 ? 30 : 10 + Math.round(depth * 10));
      });
      raf = requestAnimationFrame(draw);
    };
    const goSplit = () => {
      const from = scrollY, to = stage.getBoundingClientRect().top + scrollY + 1.6 * innerHeight, d = reduce ? 0 : 3000, start = performance.now(), id = ++anim;
      const step = (nw: number) => { if (id !== anim) return; const t = d ? Math.min(1, (nw - start) / d) : 1, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; scrollTo({ top: from + (to - from) * e, behavior: "instant" }); if (t < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    const stop = () => { anim++; };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goSplit(); } };
    const onResize = () => { size(); prog(); };
    addEventListener("wheel", stop, { passive: true }); addEventListener("touchstart", stop, { passive: true });
    whole.addEventListener("click", goSplit); whole.addEventListener("keydown", onKey);
    chips.forEach((el, i) => el.addEventListener("click", () => { if (on) router.push("/app#/market/" + STOCKS[Math.floor(i / 3)].toLowerCase()); }));
    size(); prog();
    addEventListener("resize", onResize); addEventListener("scroll", prog, { passive: true });
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf); anim++;
      removeEventListener("wheel", stop); removeEventListener("touchstart", stop);
      removeEventListener("resize", onResize); removeEventListener("scroll", prog);
      field.innerHTML = "";
    };
  }, [tickers, router]);

  return (
    <div className="stage">
      <section className="hero" id="hero" ref={heroRef}>
        <canvas id="sph" aria-hidden="true" ref={canvasRef} />
        <div className="copy">
          <h1>Split a stock token into the stock and its dividends.</h1>
          <p className="lead">Robinhood stock tokens on Robinhood Chain, split into a principal token and a yield token. Keep either half, trade it, or merge them back any time.</p>
          <div className="ctas">
            <Link className="btn p lg" href="/app">
              Open the app
            </Link>
            <Link className="btn lg" href="/docs">
              How it works
            </Link>
          </div>
        </div>
        <div className="field" id="field" ref={fieldRef} />
        <div className="scrollhint" id="hint">
          scroll<i />
        </div>
      </section>
    </div>
  );
}
