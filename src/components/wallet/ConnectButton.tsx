"use client";

import { useSyncExternalStore } from "react";
import { useConnection } from "wagmi";
import { shortAddress } from "@/lib/format";
import { useMounted } from "@/lib/hooks";
import { ConnectDialog } from "./ConnectDialog";

// One connect sheet for the whole page; any action can open it.
let dialogOpen = false;
const listeners = new Set<() => void>();
function setDialog(v: boolean) {
  dialogOpen = v;
  listeners.forEach((l) => l());
}
export const openConnect = () => setDialog(true);

export function ConnectHost() {
  const open = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => dialogOpen,
    () => false,
  );
  return <ConnectDialog open={open} onClose={() => setDialog(false)} />;
}

/** The connected address, or null before hydration / when disconnected. */
export function useAccountLabel(): string | null {
  const mounted = useMounted();
  const { address, isConnected } = useConnection();
  return mounted && isConnected && address ? shortAddress(address) : null;
}
