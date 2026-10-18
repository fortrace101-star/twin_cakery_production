import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { getCatalogueSnapshot, subscribeCatalogue, type Product } from "@/lib/products";
import {
  getLastCatalogueSync,
  syncCatalogue,
  type CatalogueSource,
  type CatalogueSyncResult,
} from "@/lib/catalogue-api";

export interface CatalogueState {
  /** Active + visible products (seed until the first successful ERP sync). */
  products: Product[];
  syncing: boolean;
  source: CatalogueSource;
  error: string | undefined;
  lastSyncedAt: string | undefined;
  /** Force a fresh pull, bypassing the short dedupe window. */
  refresh: () => Promise<CatalogueSyncResult>;
}

/**
 * Live catalogue hook: subscribes to the shared store and kicks off one ERP
 * sync on mount. Components keep rendering synchronously from the store, so a
 * slow or unreachable API never blocks paint — the seed stays up until the
 * response lands, then the store swaps over and subscribers re-render.
 */
export function useCatalogue(): CatalogueState {
  const products = useSyncExternalStore(
    subscribeCatalogue,
    getCatalogueSnapshot,
    getCatalogueSnapshot,
  );
  const [sync, setSync] = useState<CatalogueSyncResult | null>(() => getLastCatalogueSync());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let alive = true;
    setSyncing(true);
    void syncCatalogue()
      .then((result) => {
        if (alive) setSync(result);
      })
      .finally(() => {
        if (alive) setSyncing(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setSyncing(true);
    return syncCatalogue({ force: true }).then((result) => {
      setSync(result);
      setSyncing(false);
      return result;
    });
  }, []);

  return {
    products,
    syncing,
    source: sync?.source ?? "seed",
    error: sync?.error,
    lastSyncedAt: sync?.syncedAt,
    refresh,
  };
}
