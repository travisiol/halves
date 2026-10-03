/**
\s* Local only: drives the built site in headless Chrome as a connected wallet
\s* against the hardhat node (8905), whose test accounts are unlocked, so
\s* eth_sendTransaction goes straight to the node. Plays: connect, Split, Claim, Merge.
\s*   Screenshots into shots/ui-*.png.
\s*
\s*   node scripts/play-ui.mjs [base=http://localhost:3905] [account]
\s*
\s* The injected provider is a test stub announced over EIP-6963; it never
\s* holds a key and only talks to http://127.0.0.1:8905.
\s*/
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.argv[2] ?? "http://localhost:3905";
const account = process.argv[3] ?? "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const out = resolve("shots");
mkdirSync(out, { recursive: true });
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => existsSync(p));
const PORT = 9348;
const proc = spawn(chrome, ["--headless=new", "--no-first-run", `--user-data-dir=${resolve(".capture-profile-ui")}`, `--remote-debugging-port=${PORT}`, "--window-size=1536,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STUB = `(() => {
  const account = ${JSON.stringify(account)};
  const rpc = async (method, params) => {
    const r = await fetch("http://127.0.0.1:8905", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }) });
    const j = await r.json();
    if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; }
    return j.result;
  };
  const listeners = {};
  const provider = {
    isMetaMask: false,
    request: async ({ method, params }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [account];
      if (method === "eth_chainId") return "0x7a69";
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "wallet_requestPermissions" || method === "wallet_getPermissions") return [{ parentCapability: "eth_accounts" }];
      if (method === "eth_sendTransaction") { const tx = { ...params[0], from: account }; return rpc(method, [tx]); }
      return rpc(method, params);
    },
    on: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
    removeListener: (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); },
  };
  const info = { uuid: "7d0c7c39-0000-4000-8000-000000000001", name: "Local test wallet", icon: "data:image/sv\S+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%23141411'/%3E%3C/svg%3E", rdns: "local.test.wallet" };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
})();`;

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) rej(new Error(m.error.message));
        else res(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
}

async function main() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break;
    } catch {}
    await sleep(200);
  }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  const cdp = new Cdp(ws);
  const js = async (expression) => (await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  const shot = async (name) => {
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(resolve(out, `${name}.png`), Buffer.from(data, "base64"));
    console.log(`${name}.png`);
  };
  const clickText = (text) => js(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes(${JSON.stringify(text)})); if (b) b.click(); return Boolean(b); })()`);

  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1536, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: STUB });
  const node = async (method, params) => (await (await fetch("http://127.0.0.1:8905", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
  const STOCK = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const bal = async () => BigInt(await node("eth_call", [{ to: STOCK, data: "0x70a08231" + account.slice(2).toLowerCase().padStart(64, "0") }, "latest"]));
  const fmt = (v) => (Number(v) / 1e18).toString();
  const status = () => js(`document.querySelector("#ticket [role=status]")?.innerText`);
  const typeAmount = (v) =>
    js(`(() => { const i = document.querySelector("#ticket input"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event("input", { bubbles: true })); return i.value; })()`);
  const waitStatus = async (re) => {
    for (let k = 0; k < 80; k++) {
      const t = await status();
      if (t && re.test(t)) return t;
      await sleep(500);
    }
    return status();
  };
  const sum = () => js(`document.querySelector("#ticket .sum")?.innerText.replace(/\\n/g, " ")`);

  console.log("raw SPY before:", fmt(await bal()));
  await cdp.send("Page.navigate", { url: base + "/app#/market/spy" });
  await sleep(8000);
  console.log("connect chip:", await clickText("Connect wallet"));
  await sleep(800);
  console.log("pick wallet:", await clickText("Local test wallet"));
  await sleep(4000);
  console.log("typed:", await typeAmount("10"));
  await sleep(800);
  console.log("split quote:", await sum());
  await shot("ui-quote-1536");
  const btn = await js(`document.querySelector("#ticket .btnp")?.textContent`);
  console.log("button:", btn);
  await clickText(btn);
  console.log("split status:", await waitStatus(/Split done|fail|revert|cancel/i));
  await sleep(2500);
  console.log("raw SPY after split:", fmt(await bal()));
  await shot("ui-split-1536");

  // A reinvested dividend: the mock's multiplier goes from 1 to 1.25, sent from the first node account.
  const accts = await node("eth_accounts", []);
  await node("eth_sendTransaction", [{ from: accts[0], to: STOCK, data: "0x641579a6" + (1250000000000000000n).toString(16).padStart(64, "0") }]);
  await cdp.send("Page.reload");
  await sleep(9000);
  console.log("claim button:", await js(`[...document.querySelectorAll("#ticket .btns")].map((b) => b.textContent)[0]`));
  console.log("yield kpi:", await js(`[...document.querySelectorAll(".kpi")].map((k) => k.innerText.replace(/\\n/g, " ")).join(" | ")`));
  await shot("ui-yield-1536");
  await clickText("Claim ");
  console.log("claim status:", await waitStatus(/claimed|fail|revert/i));
  await sleep(2500);
  console.log("raw SPY after claim:", fmt(await bal()));

  await js(`[...document.querySelectorAll("#ticket [role=tab]")].find((b) => b.textContent === "Merge")?.click()`);
  await sleep(800);
  await typeAmount("5");
  await sleep(800);
  console.log("merge quote:", await sum());
  await clickText("Merge into");
  console.log("merge status:", await waitStatus(/Merged|fail|revert/i));
  await sleep(3000);
  console.log("raw SPY after merge:", fmt(await bal()));
  await shot("ui-merged-1536");
  ws.close();
}

try {
  await main();
} finally {
  proc.kill();
}
