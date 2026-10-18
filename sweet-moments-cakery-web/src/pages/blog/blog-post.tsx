import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock } from "lucide-react";
import { PageBanner } from "@/components/cakery/site-shell";
import { usePageMeta } from "@/lib/page-meta";
import { useBlogPost } from "@/hooks/use-blog-post";
import { formatBlogDate } from "@/lib/blog-seed";

export function BlogPostPage() {
  const { slug } = useParams();
  const { post, source, loading, error } = useBlogPost(slug ?? "");

  usePageMeta(
    post ? post.title : "Post not found",
    post ? post.excerpt : "The post you were looking for does not exist.",
  );

  // No bundled starter post for this slug: wait for the ERP before deciding.
  if (!post && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading post…</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-7xl font-bold text-foreground">404</h1>
          <h2 className="mt-4 text-xl font-semibold text-foreground">Post not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The post you are looking for does not exist or has been moved.
          </p>
          <div className="mt-6">
            <Link
              to="/blog"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Back to blog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageBanner title={post.title} description={post.excerpt} tag={post.category || "Blog"} />
      <section className="section blog-post">
        <div className="blog-post-meta">
          {post.category && <span className="blog-category">{post.category}</span>}
          <time dateTime={post.publishedAt} className="blog-date">
            <Clock size={12} /> {formatBlogDate(post.publishedAt)}
          </time>
        </div>
        <h1>{post.title}</h1>
        <div className="blog-body" dangerouslySetInnerHTML={{ __html: post.body }} />
        {source === "seed" && error && (
          <p className="empty-note">
            The live post could not be reached, so we are showing our starter copy instead ({error}
            ).
          </p>
        )}
        <div className="blog-post-nav">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Back to blog
          </Link>
        </div>
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Blog content shown here is illustrative. The Twin Cakery team adds new posts from time to
          time.
        </p>
      </section>
    </>
  );
}
