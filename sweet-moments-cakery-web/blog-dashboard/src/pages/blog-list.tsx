import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { blogApi, getToken, type BlogPost } from "@/lib/blog-api";

/** Where the public website runs in development (for "view on site" links). */
const SITE_URL = (import.meta.env?.["VITE_SITE_URL"] as string | undefined) ?? "http://localhost:5173";

export function BlogListPage() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPosts(await blogApi.listPosts());
    } catch (err) {
      setPosts(null);
      setError(err instanceof Error ? err.message : "Failed to load posts");
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      window.location.assign("/login");
      return;
    }
    void load();
  }, [load]);

  async function togglePublish(post: BlogPost) {
    setBusyId(post.id);
    setError(null);
    try {
      const updated = await blogApi.setPublished(post.id, post.status !== "PUBLISHED");
      setPosts((list) => list?.map((p) => (p.id === updated.id ? updated : p)) ?? list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update post");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(post: BlogPost) {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setBusyId(post.id);
    setError(null);
    try {
      await blogApi.deletePost(post.id);
      setPosts((list) => list?.filter((p) => p.id !== post.id) ?? list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post");
    } finally {
      setBusyId(null);
    }
  }

  if (error && posts === null) {
    return (
      <div className="blog-list-page">
        <p className="form-message">{error}</p>
        <div className="blog-list-actions">
          <Link to="/login" className="ghost-cta">
            Sign in again
          </Link>
          <button type="button" className="ghost-cta" onClick={() => void load()}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="blog-list-page">
      <header className="blog-list-head">
        <div>
          <h1>Blog posts</h1>
          <p>
            Drafts stay private until published. Published posts appear on the website at{" "}
            <a href={`${SITE_URL}/blog`} target="_blank" rel="noreferrer">
              /blog
            </a>
            .
          </p>
        </div>
        <div className="blog-list-actions">
          <Link to="/new" className="round-cta">
            <Plus /> Write a post
          </Link>
        </div>
      </header>

      {error && <p className="form-message">{error}</p>}

      <section className="blog-list">
        {posts === null ? (
          <p className="empty-state">Loading posts…</p>
        ) : posts.length === 0 ? (
          <p className="empty-state">No posts yet — write your first one.</p>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="blog-post-card">
              <div className="blog-post-card-head">
                <h3>{post.title || "(untitled)"}</h3>
                <span className={`post-status post-status-${post.status.toLowerCase()}`}>
                  {post.status}
                </span>
              </div>
              <span className="blog-post-card-slug">/{post.slug}</span>
              {post.excerpt && <p className="blog-post-card-excerpt">{post.excerpt}</p>}
              <div className="blog-post-card-actions">
                <button
                  type="button"
                  className="ghost-cta"
                  disabled={busyId === post.id}
                  onClick={() => void togglePublish(post)}
                >
                  {post.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                </button>
                {post.status === "PUBLISHED" && (
                  <a
                    className="ghost-cta"
                    href={`${SITE_URL}/blog/${post.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on site
                  </a>
                )}
                <button
                  type="button"
                  className="ghost-cta ghost-cta-danger"
                  disabled={busyId === post.id}
                  onClick={() => void remove(post)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

