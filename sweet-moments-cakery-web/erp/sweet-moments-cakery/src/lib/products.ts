import { z } from "zod";
import { api } from "./api";

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
// Legacy `cakes` seed — mapped to the new DB-shaped schema so bootstrap never
// hands Zod an undefined `status` / `visible` field.
// ---------------------------------------------------------------------------
const LEGACY_SEED: Array<{
  name: string;
  category: string;
  description: string;
  position: string;
  status?: "active" | "archived";
  visible?: boolean;
}> = [
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
];

let store: Product[] = [];

export function listActiveProducts(): Product[] {
  return store.filter((p) => p.status === "active" && p.visible);
}

export function listAllProducts(): Product[] {
  return [...store];
}

export function publishFromErp(product: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> {
  return api.post("/erp/products", product).then((res) => {
    store = [...store.filter((p) => p.id !== res.id), res];
    return res;
  });
}

export function editProduct(id: string, patch: Partial<Omit<Product, "id" | "createdAt">>): Promise<Product | null> {
  return api.patch(`/erp/products/${id}`, patch).then((res) => {
    const idx = store.findIndex((p) => p.id === id);
    if (idx !== -1) store[idx] = res;
    return res;
  }).catch(() => null);
}

export function archiveProduct(id: string): Promise<boolean> {
  return api.post(`/erp/products/${id}/archive`).then(() => true);
}

export function activateProduct(id: string): Promise<boolean> {
  return api.post(`/erp/products/${id}/activate`).then(() => true);
}

export function toggleProductVisibility(id: string): Promise<boolean> {
  return api.patch(`/erp/products/${id}/visible`, { visible: true }).then(() => true);
}

export function deleteProduct(id: string): Promise<boolean> {
  return api.delete(`/erp/products/${id}`).then(() => true);
}

export function bootstrapFromErp(products: Array<Omit<Product, "id" | "createdAt">>) {
  // Legacy seed data arrives with the old field names; map them to the DB
  // schema before Zod parses. The status/visible values below come from the
  // seed rows, never undefined.
  store = products.map((p) => ({
    ...p,
    id: `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: p.status ?? "active",
    visible: p.visible ?? true,
  }));
}

export function getAllProducts(): Product[] {
  return store;
}

export const products: Product[] = store;

// Seed the store from the legacy `cakes` export so the public catalogue has
// content straight out of the box. The ERP entry interface is the only thing
// that should change this list going forward.
bootstrapFromErp(LEGACY_SEED);

export async function syncFromDb(): Promise<void> {
  try {
    const res = await api.get<Product[]>("/erp/products");
    store = res.data.map((p: any) => ({
      ...productSchema.parse(p),
      visible: p.catalogueVisible,
    }));
  } catch {
    // Leave the in-memory store untouched on network failure.
  }
}
