import type { ErpBlogPost } from "./blog-api";

/**
 * Bundled starter posts for the public blog.
 *
 * Shown until the first successful ERP sync, and kept when the ERP API is
 * unreachable — the same resilience pattern the catalogue seed uses. Live
 * posts are authored in the ERP and flow from the shared database, so this
 * file is the website's offline fallback, not a second source of truth.
 *
 * Seed bodies are authored HTML paragraphs; ERP posts carry their own body
 * markup and both render through the same path.
 */

export interface BlogSeedPost extends ErpBlogPost {
  /** Rendered HTML body; ERP posts carry their own, seeds carry our prose. */
  body: string;
}

export const SEED_POSTS: BlogSeedPost[] = [
  {
    id: "seed-why-twin-cakery-uses-whatsapp-for-orders",
    slug: "why-twin-cakery-uses-whatsapp-for-orders",
    title: "Why Twin Cakery uses WhatsApp for orders",
    excerpt:
      "Every cake starts as a conversation. Here's why ordering by WhatsApp keeps things simple, personal and reliable.",
    body:
      "<p>Nearly every cake at Twin Cakery starts as a conversation. We settle the occasion, the flavours, the size and the delivery window before anything is committed, which is why most of our orders arrive through WhatsApp.</p>" +
      "<p>Sending a request opens a chat with the Twin Cakery team directly. You can paste photos, confirm details and ask for availability and pricing in the same thread. Nothing is confirmed or paid until you say so.</p>" +
      "<p>It keeps things simple for us and for you. There is no portal to log into, no waiting on an email reply, and no card to capture before you are ready.</p>",
    category: "Studio notes",
    publishedAt: "2026-10-02",
  },
  {
    id: "seed-from-our-kitchen-to-your-table",
    slug: "from-our-kitchen-to-your-table",
    title: "From our kitchen to your table",
    excerpt:
      "A quick look behind the counter at how a made-to-order cake moves from idea to delivery.",
    body:
      "<p>A made-to-order cake moves quickly once it is quoted. We build it on the day you approve, proof the layers overnight, decorate to your agreed design, and deliver within the window we agreed at the start.</p>" +
      "<p>Every cake is wrapped by hand and checked against your brief before it leaves the kitchen. We never rush a layer we are not happy with.</p>",
    category: "Studio notes",
    publishedAt: "2026-09-28",
  },
  {
    id: "seed-mini-cakes-for-just-about-any-occasion",
    slug: "mini-cakes-for-just-about-any-occasion",
    title: "Mini cakes for just about any occasion",
    excerpt: "Bite-sized celebrations that disappear in seconds and still do the talking for you.",
    body:
      "<p>Mini cakes are our answer to a celebration that outgrows a single slice. They travel easily, photograph well, and disappear within seconds while still doing the talking.</p>" +
      "<p>Because they are small, they are also easier to sample before the main cake arrives. You can try a flavour or two and decide whether the bigger version belongs on the table too.</p>",
    category: "Recipes & ideas",
    publishedAt: "2026-09-20",
  },
];

/** Look up a bundled starter post by slug. */
export function findSeedPost(slug: string): BlogSeedPost | undefined {
  return SEED_POSTS.find((post) => post.slug === slug);
}

/** Format an ISO date for display (same locale the original blog pages used). */
export function formatBlogDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" });
}
