import { describe, expect, it, vi } from "vitest";

describe("request()", () => {
  it("throws on a 200 response with an HTML body", async () => {
    const res = new Response("<!doctype html><html><body>not json</body></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res);
    try {
      const { request, ApiError } = await import("@/lib/api");
      await expect(request("/customers")).rejects.toBeInstanceOf(ApiError);
    } finally {
      (globalThis as { fetch: typeof globalThis["fetch"] }).fetch = () => res;
    }
  });

  it("rejects with ApiError on a non-2xx JSON body", async () => {
    const res = new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res);
    try {
      const { request, ApiError } = await import("@/lib/api");
      await expect(request("/orders")).rejects.toBeInstanceOf(ApiError);
    } finally {
      (globalThis as { fetch: typeof globalThis["fetch"] }).fetch = () => res;
    }
  });
});

describe("safe()", () => {
  it("returns the fallback when the wrapped function resolves to null", async () => {
    const { safe } = await import("@/lib/api");
    const fallback = [] as unknown[];
    const res = await safe(() => Promise.resolve<unknown>(null), fallback);
    expect(res).toBe(fallback);
  });

  it("returns the fallback when the wrapped function resolves to undefined", async () => {
    const { safe } = await import("@/lib/api");
    const fallback = [1, 2];
    const res = await safe(
      () => Promise.resolve<number[] | undefined>(undefined),
      fallback,
    );
    expect(res).toBe(fallback);
  });

  it("rethrows an AbortError", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("aborted", "AbortError"));
    try {
      const { safe } = await import("@/lib/api");
      await expect(safe(() => Promise.resolve(1), 0)).rejects.toThrow("AbortError");
    } finally {
      (globalThis as { fetch: typeof globalThis["fetch"] }).fetch = () => {
        throw new DOMException("aborted", "AbortError");
      };
    }
  });

  it("passes through a normal result unchanged", async () => {
    const { safe } = await import("@/lib/api");
    const res = await safe(() => Promise.resolve({ hasHistory: true }), null);
    expect(res).toEqual({ hasHistory: true });
  });
});
