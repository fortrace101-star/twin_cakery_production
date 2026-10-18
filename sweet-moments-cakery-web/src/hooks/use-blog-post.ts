import { useCallback, useEffect, useState } from "react";
import { fetchPublicBlogPost, type ErpBlogPostDetail } from "@/lib/blog-api";
import { findSeedPost, type BlogSeedPost } from "@/lib/blog-seed";

export type BlogPost = BlogSeedPost | ErpBlogPostDetail;

export interface BlogPostState {
  /** The post to render, or null when neither the ERP nor the seeds have it. */
  post: BlogPost | null;
  /** "erp" once the live post loads; "seed" while showing starter copy; "none" when unknown. */
  source: "erp" | "seed" | "none";
  loading: boolean;
  error: string | undefined;
}

/**
 * Live blog post hook: pulls one published post from the ERP public endpoint,
 * falling back to the bundled starter post with the same slug. Unknown slugs
 * stay null so the page can render its own "post not found" view once loading
 * finishes (same resilience pattern as useBlog).
 */
export function useBlogPost(slug: string): BlogPostState {
  const [state, setState] = useState<BlogPostState>(() => {
    const seed = findSeedPost(slug);
    return seed
      ? { post: seed, source: "seed", loading: true, error: undefined }
      : { post: null, source: "none", loading: true, error: undefined };
  });

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const live = await fetchPublicBlogPost(slug, signal);
        setState({ post: live, source: "erp", loading: false, error: undefined });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : String(err);
        setState((s) => {
          if (s.source === "erp") return s; // a newer load already succeeded
          const seed = findSeedPost(slug);
          return seed
            ? { post: seed, source: "seed", loading: false, error: message }
            : { post: null, source: "none", loading: false, error: message };
        });
      }
    },
    [slug],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return state;
}
