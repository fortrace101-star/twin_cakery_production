import { useSyncExternalStore } from "react";

export const MOBILE_QUERY = "(max-width: 767.98px)";

export function useMediaQuery(query: string): boolean {
  const subscribe = (cb: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const m = window.matchMedia(query);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
  };
  const getSnapshot = () =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false;
  const getServerSnapshot = () => false;
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);

