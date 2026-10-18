import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { PageBanner } from "@/components/cakery/site-shell";
import { usePageMeta } from "@/lib/page-meta";
import { useBlog } from "@/hooks/use-blog";
import { SEED_POSTS, formatBlogDate } from "@/lib/blog-seed";

export function BlogPage() {
  usePageMeta("Blog", "Read the latest notes, stories and tutorials from Twin Cakery.");

  const { posts, source, loading, error } = useBlog({
    posts: SEED_POSTS,
    categories: [],
  });

  return (
    <>
      <PageBanner
        title="Blog"
        description="Read the latest notes, stories and tutorials from Twin Cakery."
        tag="Blog"
      />
      <section className="section">
        <div className="section-title">
          <span className="sticker">FROM THE KITCHEN</span>
          <h2>
            SWEET NOTES.
            <br />
            STORIED.
          </h2>
          <p>
            Regular updates from the kitchen, plus ideas and stories worth sharing. New posts are
            baked roughly twice a month.
          </p>
          {source === "seed" && (
            <p className="empty-note">
              {error
                ? `The live blog could not be reached, so we are showing our starter posts instead (${error}).`
                : loading
                  ? "Loading the latest posts…"
                  : "Showing our starter posts while the live blog loads."}
            </p>
          )}
        </div>
        <div className="blog-grid">
          {posts.map((post) => (
            <article key={post.slug} className="blog-card">
              <div className="blog-card-header">
                {post.category && <span className="blog-category">{post.category}</span>}
                <time dateTime={post.publishedAt} className="blog-date">
                  <Clock size={12} /> {formatBlogDate(post.publishedAt)}
                </time>
              </div>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <div className="blog-card-actions">
                <Link to={`/blog/${post.slug}`}>
                  Read more
                  <ArrowRight />
                </Link>
              </div>
            </article>
          ))}
        </div>
        {posts.length === 0 && !loading && (
          <p className="empty-note">No posts yet — check back soon.</p>
        )}
        <div className="blog-browse">
          <Link
            to="/blog"
            className="round-cta"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            Read all posts
            <ArrowRight />
          </Link>
        </div>
      </section>
    </>
  );
}
