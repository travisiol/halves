"use client";

import { useEffect, useState } from "react";
import { useConnect, useConnectors } from "wagmi";

/** Our own connect sheet: every browser wallet announced over EIP-6963, WalletConnect when configured. */
export function ConnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const connectors = useConnectors();
  const { mutateAsync: connect, isPending, variables } = useConnect();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const named = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
  const list = connectors.filter((c) => !(c.id === "injected" && named.length > 0));
  const pendingUid = isPending ? (variables as { connector?: { uid?: string } } | undefined)?.connector?.uid : undefined;

  const pick = async (uid: string) => {
    const c = connectors.find((x) => x.uid === uid);
    if (!c) return;
    setFailed(null);
    try {
      await connect({ connector: c });
      onClose();
    } catch (e) {
      const msg = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? "Connection failed.";
      setFailed(msg.split("\n")[0].slice(0, 160));
    }
  };

  return (
    <div className="cdlg" onClick={onClose} role="dialog" aria-modal="true" aria-label="Connect a wallet">
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="x" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2>Connect a wallet</h2>
        <p>Robinhood Chain. Connecting only shares your address; every action asks your wallet first.</p>
        <ul>
          {list.map((c) => (
            <li key={c.uid}>
              <button type="button" disabled={isPending} onClick={() => pick(c.uid)}>
                {c.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.icon} alt="" />
                ) : (
                  <span className="ph" />
                )}
                <span>{c.name === "Injected" ? "Browser wallet" : c.name}</span>
                <em>{pendingUid === c.uid ? "Waiting…" : c.type === "walletConnect" ? "QR code" : ""}</em>
              </button>
            </li>
          ))}
        </ul>
        {failed ? (
          <p className="err" role="alert">
            {failed}
          </p>
        ) : null}
      </div>
    </div>
  );
}
