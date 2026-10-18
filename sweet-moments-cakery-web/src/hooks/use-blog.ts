import { useCallback, useEffect, useState } from "react";
import { fetchPublicBlog, type ErpBlogPost, type ErpBlogCategory } from "@/lib/blog-api";

export interface BlogState {
  posts: ErpBlogPost[];
  categories: ErpBlogCategory[];
  /** "erp" once live posts load; "seed" until then or if the API is unreachable. */
  source: "erp" | "seed";
  loading: boolean;
  error: string | undefined;
}

/**
 * Live blog hook: pulls published posts from the ERP public endpoint on mount.
 * Falls back to the bundled starter posts when the API is unreachable so the
 * Blog page always renders (same resilience pattern as useCatalogue).
 */
export function useBlog(seed: { posts: ErpBlogPost[]; categories: ErpBlogCategory[] }): BlogState {
  const [state, setState] = useState<BlogState>({
    posts: seed.posts,
    categories: seed.categories,
    source: "seed",
    loading: true,
    error: undefined,
  });

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const live = await fetchPublicBlog(signal);
      setState({
        posts: live.posts,
        categories: live.categories,
        source: "erp",
        loading: false,
        error: undefined,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setState((s) => ({
        ...s,
        source: "seed",
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return state;
}
