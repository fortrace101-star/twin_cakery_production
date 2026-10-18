import { afterEach, describe, expect, it, vi } from "vitest";

import { blogApi, ApiError, getToken, setToken } from "@/lib/blog-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const samplePost = {
  id: "bpost-1",
  categoryId: "bcat-studio",
  title: "Hello",
  slug: "hello",
  excerpt: "",
  body: "<p>Hi</p>",
  coverImage: "",
  author: "Twin Cakery",
  status: "PUBLISHED",
  publishedAt: "2026-10-11T00:00:00.000Z",
  createdBy: "usr-manager",
  createdAt: "2026-10-11T00:00:00.000Z",
  updatedAt: "2026-10-11T00:00:00.000Z",
};

describe("blogApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setToken(null);
  });

  it("logs in and stores the token", async () => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve(
        jsonResponse({
          token: "tc_test_token",
          user: { id: "usr-manager", username: "manager", displayName: "Manager", role: "Admin", isAdmin: true },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const session = await blogApi.login("manager", "TwinCakery123!");

    expect(session.token).toBe("tc_test_token");
    expect(getToken()).toBe("tc_test_token");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ username: "manager", password: "TwinCakery123!" });
  });

  it("attaches the bearer token on authenticated calls", async () => {
    setToken("tc_stored_token");
    const fetchMock = vi.fn(async () => Promise.resolve(jsonResponse([])));
    vi.stubGlobal("fetch", fetchMock);

    await blogApi.listPosts();

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tc_stored_token");
  });

  it("creates a post with the payload the ERP expects", async () => {
    setToken("tc_stored_token");
    const fetchMock = vi.fn(async () => Promise.resolve(jsonResponse(samplePost)));
    vi.stubGlobal("fetch", fetchMock);

    const created = await blogApi.createPost({
      title: "Hello",
      slug: "hello",
      excerpt: "",
      body: "<p>Hi</p>",
      author: "Twin Cakery",
      status: "PUBLISHED",
      categoryId: "bcat-studio",
    });

    expect(created).toMatchObject({ id: "bpost-1", status: "PUBLISHED", slug: "hello" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/content/blog/posts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      title: "Hello",
      status: "PUBLISHED",
      categoryId: "bcat-studio",
    });
  });

  it("publishes and unpublishes via a status patch", async () => {
    setToken("tc_stored_token");
    const fetchMock = vi.fn(async () =>
      Promise.resolve(jsonResponse({ ...samplePost, status: "DRAFT" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const updated = await blogApi.setPublished("bpost-1", false);

    expect(updated.status).toBe("DRAFT");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/content/blog/posts/bpost-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ status: "DRAFT" });
  });

  it("throws ApiError with the server message on a failed write", async () => {
    setToken("tc_stored_token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.resolve(jsonResponse({ error: "title and body are required" }, 400))),
    );

    await expect(blogApi.createPost({ title: "" })).rejects.toThrow(ApiError);
    await expect(blogApi.createPost({ title: "" })).rejects.toThrow("title and body are required");
  });

  it("throws ApiError when the network is unreachable", async () => {
    setToken("tc_stored_token");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network down"))));

    await expect(blogApi.listPosts()).rejects.toThrow(/Network request failed/);
  });

  it("clears the token on logout", () => {
    setToken("tc_stored_token");
    blogApi.logout();
    expect(getToken()).toBeNull();
  });
});

