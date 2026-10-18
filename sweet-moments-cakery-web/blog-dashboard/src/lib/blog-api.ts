/**
 * Client for the Twin Cakery ERP blog API (authenticated "Site Management").
 *
 *   POST {API_BASE}/auth/login                -> { token, user }
 *   GET  {API_BASE}/content/blog/posts        -> BlogPost[]      (auth)
 *   POST {API_BASE}/content/blog/posts        -> BlogPost        (auth)
 *   PATCH/DELETE {API_BASE}/content/blog/posts/:id               (auth)
 *   GET  {API_BASE}/content/blog/categories   -> BlogCategory[]  (auth)
 *
 * The Vite dev server proxies `/api` to `http://localhost:4000` (see
 * vite.config.ts). The JWT-ish session token is persisted in localStorage and
 * attached as a Bearer token; writes are RBAC-guarded server-side
 * (`content.view` / `content.create` / `content.edit`, granted to Admin).
 *
 * Only PUBLISHED posts are visible on the public website
 * (`GET /api/v1/public/blog`), so the dashboard always shows the status and
 * lets you publish/unpublish — a DRAFT never appears on twin-cakery.com.
 */

export const API_BASE = (import.meta.env?.["VITE_API_URL"] as string | undefined) ?? "/api/v1";
const TOKEN_KEY = "twin_cakery_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPost {
  id: string;
  categoryId: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImage: string;
  author: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isAdmin: boolean;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

/* ── Token storage ──────────────────────────────────────────────────────── */

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) — non-fatal */
  }
}

/* ── Core request helper ────────────────────────────────────────────────── */

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(
      "Network request failed — is the ERP API running on http://localhost:4000?",
      0,
    );
  }
  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!res.ok) {
    const message =
      (payload as { error?: string; message?: string } | null)?.error ??
      (payload as { error?: string; message?: string } | null)?.message ??
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return payload as T;
}

/* ── API surface ────────────────────────────────────────────────────────── */

export const blogApi = {
  /** Sign in with an ERP account (e.g. the seeded `manager`). Stores the token. */
  login: async (username: string, password: string): Promise<AuthSession> => {
    const session = await request<AuthSession>("/auth/login", {
      method: "POST",
      body: { username, password },
      auth: false,
    });
    setToken(session.token);
    return session;
  },

  logout: (): void => setToken(null),

  listCategories: (): Promise<BlogCategory[]> => request<BlogCategory[]>("/content/blog/categories"),

  createCategory: (
    payload: { name: string; description?: string; displayOrder?: number },
  ): Promise<BlogCategory> =>
    request<BlogCategory>("/content/blog/categories", { method: "POST", body: payload }),

  listPosts: (): Promise<BlogPost[]> => request<BlogPost[]>("/content/blog/posts"),

  getPost: (id: string): Promise<BlogPost> => request<BlogPost>(`/content/blog/posts/${id}`),

  createPost: (payload: Partial<BlogPost>): Promise<BlogPost> =>
    request<BlogPost>("/content/blog/posts", { method: "POST", body: payload }),

  updatePost: (id: string, patch: Partial<BlogPost>): Promise<BlogPost> =>
    request<BlogPost>(`/content/blog/posts/${id}`, { method: "PATCH", body: patch }),

  deletePost: (id: string): Promise<void> =>
    request<void>(`/content/blog/posts/${id}`, { method: "DELETE" }),

  /** Publish or unpublish a post (the ERP stamps publishedAt on first publish). */
  setPublished: (id: string, published: boolean): Promise<BlogPost> =>
    request<BlogPost>(`/content/blog/posts/${id}`, {
      method: "PATCH",
      body: { status: published ? "PUBLISHED" : "DRAFT" },
    }),
};

