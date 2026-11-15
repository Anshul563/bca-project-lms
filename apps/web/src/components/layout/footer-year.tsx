"use client";

import { useSyncExternalStore } from "react";

/**
 * Copyright year read through `useSyncExternalStore` so the value is never
 * computed during prerender (the clock is not a stable value under
 * `cacheComponents`) and always reflects the live client clock after hydration.
 */
const subscribe = () => {
  // The year changes at most at midnight; no reactive subscription is needed.
  return () => {};
};

const getSnapshot = () => new Date().getFullYear();
const getServerSnapshot = () => 2026;

export function FooterYear() {
  return <>{useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)}</>;
}

