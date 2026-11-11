import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let originalFetch: typeof globalThis.fetch;

function setFetch(
  resolver: (body: string, init?: RequestInit) => Response | Promise<Response>,
): void {
  originalFetch = globalThis.fetch;
  (globalThis as { fetch: typeof globalThis["fetch"] }).fetch = vi
    .fn()
    .mockImplementation(async (input, init) => resolver(String(input), init));
}

function restoreFetch(): void {
  (globalThis as { fetch: typeof globalThis["fetch"] }).fetch = originalFetch;
}

describe("request() non-JSON 200", () => {
  beforeEach(() => {
    setFetch((body) =>
      new Response(body, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
  });

  afterEach(() => {
    restoreFetch();
  });

  it("throws ApiError when the body is not valid JSON", async () => {
    const { request, ApiError } = await import("@/lib/api");
    await expect(request("/customers")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("safe()", () => {
  beforeEach(() => {
    setFetch((body, init) =>
      new Response(body, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    restoreFetch();
  });

  it("returns the fallback when the wrapped function resolves to null", async () => {
    const { safe } = require("../lib/api.ts");
    const fallback = [] as unknown[];
    const res = await safe(() => Promise.resolve<unknown>(null), fallback);
    expect(res).toBe(fallback);
  });

  it("returns the fallback when the wrapped function resolves to undefined", async () => {
    const { safe } = require("../lib/api.ts");
    const fallback = [1, 2];
    const res = await safe(
      () => Promise.resolve<number[] | undefined>(undefined),
      fallback,
    );
    expect(res).toBe(fallback);
  });

  it("rethrows an AbortError", async () => {
    setFetch(() => {
      throw new DOMException("aborted", "AbortError");
    });
    const { safe } = require("../lib/api.ts");
    await expect(safe(() => Promise.resolve(1), 0)).rejects.toThrow("AbortError");
  });

  it("passes through a normal result unchanged", async () => {
    const { safe } = require("../lib/api.ts");
    const res = await safe(() => Promise.resolve({ hasHistory: true }), null);
    expect(res).toEqual({ hasHistory: true });
  });
});
