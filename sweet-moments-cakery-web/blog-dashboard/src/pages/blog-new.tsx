import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { blogApi, getToken, type BlogCategory } from "@/lib/blog-api";

type FormData = {
  title: string;
  slug: string;
  excerpt: string;
  categoryId: string;
  body: string;
  author: string;
  status: "DRAFT" | "PUBLISHED";
};

export function BlogNewPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [form, setForm] = useState<FormData>({
    title: "",
    slug: "",
    excerpt: "",
    categoryId: "",
    body: "",
    author: "Twin Cakery",
    status: "PUBLISHED",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      window.location.assign("/login");
      return;
    }
    blogApi
      .listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  function change<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    setMessage(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await blogApi.createPost({
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        excerpt: form.excerpt.trim(),
        body: form.body,
        author: form.author.trim(),
        status: form.status,
        categoryId: form.categoryId || null,
      });
      navigate("/");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="blog-new-page">
      <header className="blog-new-head">
        <Link to="/" className="round-cta">
          <ArrowLeft />
          All posts
        </Link>
        <div>
          <h1>Write a post</h1>
          <p>
            Give your post a slug, category and a short preview.{" "}
            {form.status === "PUBLISHED"
              ? "It will appear on the website immediately."
              : "Drafts stay hidden from the website until you publish them."}
          </p>
        </div>
      </header>

      <form className="blog-form" onSubmit={submit}>
        <label className="field">
          Title
          <input
            value={form.title}
            onChange={(e) => change("title", e.target.value)}
            placeholder="e.g. Why Twin Cakery uses WhatsApp for orders"
            autoFocus
            required
          />
        </label>
        <label className="field">
          Slug <span className="field-hint">(leave blank to generate from the title)</span>
          <input
            value={form.slug}
            onChange={(e) => change("slug", e.target.value)}
            placeholder="e.g. why-twin-cakery-uses-whatsapp-for-orders"
          />
        </label>
        <div className="field-row">
          <label className="field">
            Category
            <select value={form.categoryId} onChange={(e) => change("categoryId", e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Status
            <select
              value={form.status}
              onChange={(e) => change("status", e.target.value as FormData["status"])}
            >
              <option value="PUBLISHED">Published (visible on the website)</option>
              <option value="DRAFT">Draft (hidden)</option>
            </select>
          </label>
        </div>
        <label className="field">
          Author
          <input value={form.author} onChange={(e) => change("author", e.target.value)} />
        </label>
        <label className="field">
          Excerpt
          <textarea
            value={form.excerpt}
            onChange={(e) => change("excerpt", e.target.value)}
            placeholder="One or two lines shown on the blog list."
            rows={3}
          />
        </label>
        <label className="field">
          Body <span className="field-hint">(HTML — use &lt;p&gt; for paragraphs)</span>
          <textarea
            value={form.body}
            onChange={(e) => change("body", e.target.value)}
            placeholder="<p>Your story starts here…</p>"
            rows={16}
            required
          />
        </label>
        {message && <p className="form-message">{message}</p>}
        <button type="submit" className="round-cta" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save /> Save post
            </>
          )}
        </button>
      </form>
    </div>
  );
}
