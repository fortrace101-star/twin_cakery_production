/**
 * Client for the public ERP blog endpoints (read-only).
 *
 *   GET {VITE_ERP_API_URL}/public/blog       -> { posts, categories }
 *   GET {VITE_ERP_API_URL}/public/blog/:slug  -> single published post
 *
 * The Express API mounts routers under `/api/v1`; the Vite dev server proxies
 * `/api/v1` to `http://localhost:4000` (see vite.config.ts). Posts are authored
 * in the ERP "Site Management" page and flow to the shared database, which
 * this endpoint reads — the website keeps no separate copy.
 *
 * Everything here is read-only: on any failure the caller falls back to the
 * bundled starter posts so the Blog page always renders.
 */

const DEFAULT_BASE = "/api/v1";

function resolveApiBase(): string {
  const configured: unknown = import.meta.env["VITE_ERP_API_URL"];
  const raw =
    typeof configured === "string" && configured.trim() !== "" ? configured : DEFAULT_BASE;
  return raw.trim().replace(/\/+$/, "");
}

export const blogApiBase: string = resolveApiBase();

export interface ErpBlogCategory {
  id: string;
  name: string;
}

export interface ErpBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string;
  author?: string;
  category?: string;
  publishedAt: string;
}

export interface ErpBlog {
  posts: ErpBlogPost[];
  categories: ErpBlogCategory[];
}

/** A single published post, including its rendered HTML body. */
export interface ErpBlogPostDetail extends ErpBlogPost {
  /** Rendered HTML body of the post. */
  body: string;
}

/** Read the published blog. Rejects on network error / non-2xx / malformed body. */
export async function fetchPublicBlog(signal?: AbortSignal): Promise<ErpBlog> {
  const url = `${blogApiBase}/public/blog`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`GET ${url} responded ${response.status}`);
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) {
    throw new Error(`GET ${url} returned a non-object body`);
  }
  const { posts, categories } = body as { posts?: unknown; categories?: unknown };
  if (!Array.isArray(posts)) throw new Error(`GET ${url} is missing posts[]`);
  return {
    posts: posts as ErpBlogPost[],
    categories: Array.isArray(categories) ? (categories as ErpBlogCategory[]) : [],
  };
}

/** Read one published post. Rejects on network error / non-2xx / malformed body. */
export async function fetchPublicBlogPost(
  slug: string,
  signal?: AbortSignal,
): Promise<ErpBlogPostDetail> {
  const url = `${blogApiBase}/public/blog/${encodeURIComponent(slug)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`GET ${url} responded ${response.status}`);
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) {
    throw new Error(`GET ${url} returned a non-object body`);
  }
  const post = body as ErpBlogPostDetail;
  if (typeof post.title !== "string" || typeof post.slug !== "string") {
    throw new Error(`GET ${url} is missing title/slug`);
  }
  return { ...post, body: typeof post.body === "string" ? post.body : "" };
}
