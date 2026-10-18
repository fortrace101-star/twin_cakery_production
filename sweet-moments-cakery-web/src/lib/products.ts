import { z } from "zod";

/**
 * Product catalogue data model.
 *
 * This is deliberately a thin, DB-shaped record. The Express ERP owns the real
 * catalogue (Postgres behind `/api/v1`); this module is the public website's
 * read model — an in-memory cache that `syncCatalogue()` in `./catalogue-api`
 * refreshes from `GET /api/v1/public/catalogue`.
 *
 * The functions below model the synchronisation loop:
 *   - syncCatalogue()          -> pull the ERP catalogue into this store
 *   - listActiveProducts()     -> what "Our cakes" renders (active + visible)
 *
 * Writes here only touch this cache: they are lost on reload and exist for the
 * in-site entry pages. Durable catalogue changes belong in the ERP API, which
 * requires an authenticated session with the `catalogue.*` permissions.
 *
 * Database entry validation uses the same shape as the public product schema so
 * the ERP writes only clean, typed records to the ecosystem database.
 */
export const productSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(150),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  position: z.string().regex(/^\d+(\.\d+)?%$/),
  status: z.enum(["active", "archived"]),
  imageUrl: z.string().url().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  visible: z.boolean().default(true),
});

export type Product = z.infer<typeof productSchema>;

// ---------------------------------------------------------------------------
// In-memory store (replaces the old export `cakes: Product[]`).
//
// `store` is the source of truth for renderers; `activeSnapshot` /
// `allSnapshot` are the stable references handed to useSyncExternalStore.
// In production this store is a cache of the ecosystem database:
//
//   syncCatalogue       -> GET  /api/v1/public/catalogue  (replaces the store)
// ---------------------------------------------------------------------------

let store: Product[] = [];

// Cached snapshots: useSyncExternalStore compares snapshots by reference, so
// they must only change when the catalogue actually changes.
let activeSnapshot: Product[] = [];
let allSnapshot: Product[] = [];
const listeners = new Set<() => void>();

function setStore(next: Product[]): void {
  store = next;
  allSnapshot = [...store];
  activeSnapshot = store.filter((p) => p.status === "active" && p.visible);
  listeners.forEach((listener) => listener());
}

/** Subscribe to catalogue changes; returns the unsubscribe function. */
export function subscribeCatalogue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot of the products the public site renders. */
export function getCatalogueSnapshot(): Product[] {
  return activeSnapshot;
}

/** Stable snapshot of every product, including archived/hidden ones. */
export function getAllProductsSnapshot(): Product[] {
  return allSnapshot;
}

/** Replace the catalogue wholesale — used by the ERP sync. */
export function applyCatalogue(products: Product[]): void {
  setStore(products);
}

export function listActiveProducts(): Product[] {
  return activeSnapshot;
}

export function listAllProducts(): Product[] {
  return allSnapshot;
}

/** Shape accepted by `bootstrapFromErp`: every product field except the id it assigns. */
export type SeedProduct = Omit<Product, "id" | "visible"> & { visible?: boolean };

/**
 * Replace the store with starter products (module init + tests).
 *
 * Seeds arrive without ids (they are website-local, not ERP rows), so each gets
 * a generated one and passes the same validation the public schema enforces —
 * rows that fail are dropped rather than crashing the catalogue. The first
 * successful ERP sync replaces this list via `applyCatalogue`.
 */
export function bootstrapFromErp(seed: SeedProduct[]): void {
  const now = new Date().toISOString();
  const products = seed
    .map((item, index) => {
      const candidate: Product = {
        id: `seed-${index}-${Date.now()}`,
        ...item,
        visible: item.visible ?? true,
        createdAt: item.createdAt ?? now,
        updatedAt: item.updatedAt ?? now,
      };
      const parsed = productSchema.safeParse(candidate);
      if (!parsed.success) {
        console.warn(
          "[catalogue] dropping starter product that failed validation",
          item.name,
          parsed.error.flatten(),
        );
        return null;
      }
      return parsed.data;
    })
    .filter((product): product is Product => product !== null);
  setStore(products);
}

// ---------------------------------------------------------------------------
// Seed the store from the legacy `cakes` export so the public catalogue has
// content straight out of the box — and keeps content if the ERP API is
// unreachable. The first successful sync replaces this list.
// ---------------------------------------------------------------------------
bootstrapFromErp([
  {
    name: "Strawberry Bliss",
    category: "Celebration cakes",
    description: "Soft layers. Fresh berries. Pure happiness.",
    position: "0%",
    status: "active",
    visible: true,
  },
  {
    name: "Chocolate Dream",
    category: "Celebration cakes",
    description: "Rich chocolate, made for the chocolate lover.",
    position: "33.333%",
    status: "active",
    visible: true,
  },
  {
    name: "Vanilla Celebration",
    category: "Wedding cakes",
    description: "A timeless favourite for your special moments.",
    position: "66.666%",
    status: "active",
    visible: true,
  },
  {
    name: "Red Velvet Love",
    category: "Sweet treats",
    description: "A little indulgence in every velvety layer.",
    position: "100%",
    status: "active",
    visible: true,
  },
]);
