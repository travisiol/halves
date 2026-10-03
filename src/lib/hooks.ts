"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** True after hydration (wallet state is only known in the browser). */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

/** The app's route, read from location.hash ("#/market/spy" → "/market/spy"). */
export function useHashRoute(): string {
  return useSyncExternalStore(subscribeHash, () => window.location.hash.replace(/^#/, "") || "/", () => "/");
}
