import { productSchema, applyCatalogue, listActiveProducts, type Product } from "./products";

/**
 * Client for the public (unauthenticated) ERP catalogue endpoint.
 *
 *   GET {VITE_ERP_API_URL}/public/catalogue -> { categories, products, featured }
 *
 * The Express API mounts its routers under `/api/v1`, so the default base path
 * is `/api/v1` and the Vite dev server proxies it to `http://localhost:4000`
 * (see vite.config.ts). Deployments set `VITE_ERP_API_URL` to the absolute ERP
 * origin, e.g. `https://erp.example.com/api/v1` — the API sends
 * `Access-Control-Allow-Origin: *`, so cross-origin reads work as-is.
 *
 * Everything here is read-only by design: the public site consumes the
 * catalogue, while writes stay behind the ERP's authenticated RBAC routes.
 */

const DEFAULT_BASE = "/api/v1";

function resolveApiBase(): string {
  const configured: unknown = import.meta.env["VITE_ERP_API_URL"];
  const raw =
    typeof configured === "string" && configured.trim() !== "" ? configured : DEFAULT_BASE;
  return raw.trim().replace(/\/+$/, "");
}

export const catalogueApiBase: string = resolveApiBase();

/** Category row as returned by the ERP (only the fields the site needs). */
export interface ErpCategory {
  id: string;
  name: string;
}

/** Product row as returned by the ERP (only the fields the site needs). */
export interface ErpProduct {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  image?: string;
  active?: boolean;
  archived?: boolean;
  catalogueVisible?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ErpCatalogue {
  categories: ErpCategory[];
  products: ErpProduct[];
}

export type CatalogueSource = "erp" | "seed";

export interface CatalogueSyncResult {
  ok: boolean;
  source: CatalogueSource;
  /** Products the public site should render (active + visible). */
  count: number;
  syncedAt: string;
  error?: string;
}

/**
 * The public sprite cycles one shared photo through four crops; the legacy seed
 * used these positions, so ERP rows reuse them in rotation.
 */
const SPRITE_POSITIONS = ["0%", "33.333%", "66.666%", "100%"] as const;

const isIsoDateTime = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

/** Convert one ERP product into the website's catalogue record. Returns null when it fails validation. */
export function mapErpProduct(
  product: ErpProduct,
  index: number,
  categories: ErpCategory[],
): Product | null {
  const category = categories.find((c) => c.id === product.categoryId)?.name ?? "";
  const imageUrl =
    typeof product.image === "string" && /^https?:\/\//i.test(product.image.trim())
      ? product.image.trim()
      : undefined;
  const createdAt = isIsoDateTime(product.createdAt) ? product.createdAt : undefined;
  const updatedAt = isIsoDateTime(product.updatedAt) ? product.updatedAt : undefined;

  const candidate = {
    id: product.id,
    name: (product.name ?? "").trim().slice(0, 150),
    category: (category.trim() || "Cakes").slice(0, 100),
    description: (product.description ?? "").slice(0, 500),
    position: SPRITE_POSITIONS[index % SPRITE_POSITIONS.length] ?? "0%",
    status:
      product.active !== false && product.archived !== true
        ? ("active" as const)
        : ("archived" as const),
    visible: product.catalogueVisible !== false,
    ...(imageUrl !== undefined ? { imageUrl } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };

  const parsed = productSchema.safeParse(candidate);
  if (!parsed.success) {
    console.warn(
      "[catalogue] dropping ERP product that failed validation",
      product.id,
      parsed.error.flatten(),
    );
    return null;
  }
  return parsed.data;
}

/** Read the public catalogue. Rejects on network errors, non-2xx responses or a malformed body. */
export async function fetchPublicCatalogue(signal?: AbortSignal): Promise<ErpCatalogue> {
  const url = `${catalogueApiBase}/public/catalogue`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    throw new Error(`GET ${url} responded ${response.status}`);
  }
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) {
    throw new Error(`GET ${url} returned a non-object body`);
  }
  const { products, categories } = body as { products?: unknown; categories?: unknown };
  if (!Array.isArray(products)) {
    throw new Error(`GET ${url} is missing products[]`);
  }
  return {
    categories: Array.isArray(categories) ? (categories as ErpCategory[]) : [],
    products: products as ErpProduct[],
  };
}

let lastSync: CatalogueSyncResult | null = null;
let inFlight: Promise<CatalogueSyncResult> | null = null;

/** Result of the most recent sync attempt, if any. */
export function getLastCatalogueSync(): CatalogueSyncResult | null {
  return lastSync;
}

const SYNC_TTL_MS = 15_000;

/**
 * Pull the ERP catalogue into the website store.
 *
 * - Succeeds even when the ERP is unreachable: the store keeps its seed and the
 *   result reports `source: "seed"` so the UI can say so.
 * - An empty ERP response is applied as-is (an empty catalogue is a real state,
 *   not a failure), so hiding a product in the ERP hides it on the website.
 * - Concurrent callers share one request; `force` bypasses the short TTL used
 *   by repeat mounts of the same page.
 */
export function syncCatalogue(options?: { force?: boolean }): Promise<CatalogueSyncResult> {
  if (inFlight) return inFlight;
  if (!options?.force && lastSync?.ok && Date.now() - Date.parse(lastSync.syncedAt) < SYNC_TTL_MS) {
    return Promise.resolve(lastSync);
  }

  const run = (async (): Promise<CatalogueSyncResult> => {
    try {
      const { products, categories } = await fetchPublicCatalogue();
      const mapped = products
        .map((product, index) => mapErpProduct(product, index, categories))
        .filter((product): product is Product => product !== null);
      applyCatalogue(mapped);
      const result: CatalogueSyncResult = {
        ok: true,
        source: "erp",
        count: listActiveProducts().length,
        syncedAt: new Date().toISOString(),
      };
      lastSync = result;
      return result;
    } catch (error) {
      const result: CatalogueSyncResult = {
        ok: false,
        source: "seed",
        count: listActiveProducts().length,
        syncedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
      lastSync = result;
      console.warn("[catalogue] ERP sync failed, keeping the local catalogue:", result.error);
      return result;
    } finally {
      inFlight = null;
    }
  })();

  inFlight = run;
  return run;
}
