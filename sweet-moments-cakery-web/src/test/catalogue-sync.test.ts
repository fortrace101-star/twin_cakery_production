import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getLastCatalogueSync,
  mapErpProduct,
  syncCatalogue,
  type ErpCategory,
  type ErpProduct,
} from "@/lib/catalogue-api";
import { bootstrapFromErp, listActiveProducts } from "@/lib/products";

const categories: ErpCategory[] = [{ id: "cat-celebration", name: "Celebration cakes" }];

const erpRow = (overrides: Partial<ErpProduct> = {}): ErpProduct => ({
  id: "prod-choc",
  name: "Chocolate celebration cake",
  description: "2kg chocolate birthday",
  categoryId: "cat-celebration",
  active: true,
  archived: false,
  catalogueVisible: true,
  image: "",
  ...overrides,
});

const seed = [
  {
    name: "Strawberry Bliss",
    category: "Celebration cakes",
    description: "Soft layers. Fresh berries. Pure happiness.",
    position: "0%",
    status: "active" as const,
    visible: true,
  },
  {
    name: "Chocolate Dream",
    category: "Celebration cakes",
    description: "Rich chocolate, made for the chocolate lover.",
    position: "33.333%",
    status: "active" as const,
    visible: true,
  },
];

describe("ERP catalogue sync", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    bootstrapFromErp(seed);
  });

  it("maps an ERP row onto the public product shape", () => {
    const mapped = mapErpProduct(erpRow(), 0, categories);

    expect(mapped).toMatchObject({
      id: "prod-choc",
      name: "Chocolate celebration cake",
      category: "Celebration cakes",
      description: "2kg chocolate birthday",
      status: "active",
      visible: true,
      position: "0%",
    });
    expect(mapped?.imageUrl).toBeUndefined();
  });

  it("cycles the sprite position across rows", () => {
    expect(mapErpProduct(erpRow(), 1, categories)?.position).toBe("33.333%");
    expect(mapErpProduct(erpRow(), 3, categories)?.position).toBe("100%");
  });

  it("drops rows that would be invisible or inactive on the website", () => {
    expect(mapErpProduct(erpRow({ active: false }), 0, categories)?.status).toBe("archived");
    expect(mapErpProduct(erpRow({ archived: true }), 0, categories)?.status).toBe("archived");
    expect(mapErpProduct(erpRow({ catalogueVisible: false }), 0, categories)?.visible).toBe(false);
  });

  it("rejects rows that fail the public schema instead of failing the whole sync", () => {
    expect(mapErpProduct(erpRow({ name: "" }), 0, categories)).toBeNull();
    expect(mapErpProduct(erpRow({ categoryId: "unknown" }), 0, categories)?.category).toBe("Cakes");
  });

  it("replaces the seed with the live ERP catalogue on success", async () => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ categories, products: [erpRow()] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncCatalogue({ force: true });

    expect(result).toMatchObject({ ok: true, source: "erp", count: 1 });
    expect(getLastCatalogueSync()?.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(listActiveProducts().map((p) => p.name)).toEqual(["Chocolate celebration cake"]);
  });

  it("keeps the local catalogue and reports the failure when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("network down"))),
    );

    const result = await syncCatalogue({ force: true });

    expect(result.ok).toBe(false);
    expect(result.source).toBe("seed");
    expect(result.error).toContain("network down");
    // Seed untouched: the website keeps rendering instead of showing an empty grid.
    expect(listActiveProducts().map((p) => p.name)).toEqual([
      "Strawberry Bliss",
      "Chocolate Dream",
    ]);
  });

  it("applies an empty ERP catalogue as-is rather than falling back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response(JSON.stringify({ categories, products: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    const result = await syncCatalogue({ force: true });

    expect(result).toMatchObject({ ok: true, source: "erp", count: 0 });
    expect(listActiveProducts()).toEqual([]);
  });
});
