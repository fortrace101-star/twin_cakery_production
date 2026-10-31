# Optim_website.md — Public Website, Intake & Content

**Module owner of:** the public site (`sweet-moments-cakery-web`), the public API (`server/routes/public.ts`), order proposals and website enquiries as they enter the ERP, blog/content rendering, website users, reference images, order tracking.
**Companion files:** `Optim_catalogue_recipes.md` (product data the site consumes), `Optim_crm.md`, `Optim_orders.md`, `Optim_quotations.md`, `Optim_notifications_audit.md`, `Optim_security_rbac.md`, `Optim_analytics.md`, `Optim_architecture.md`.

---

## 0. How to read this document

**Basis.** Everything below was checked against `twin_cakery_production-main.zip`. I did **not run** the app or the site, so runtime behaviour is reasoned from code.

| Label | Meaning |
|---|---|
| **Verified** | I read the lines and (where it is an absence claim) searched the whole tree. |
| **Inferred** | Follows from verified code; not every caller traced. |

**Unified recommendations.** Each recommendation (W-R1…W-R9) states the change in this module, then a **Cross-module changes** table covering every other module and how it changes.

**Migration numbers.** `Optim_catalogue_recipes.md` uses `022`–`026`. The migrations here start at `027` as placeholders. Other module files may also propose numbers; **renumber in the order you actually apply them** (the runner in `database/migrate.ts` applies files by name and records them in `_migrations`). Never edit a migration that has already run.

**Dependencies to install.** Server: `zod`, `helmet`, `sanitize-html`, `multer`, `sharp`, `file-type`. Website: `dompurify` (and `@types/dompurify`). I could not test installs in my environment.

---

# PART A — ASSESSMENT

## A.1 What exists (Verified)

| Piece | State |
|---|---|
| Public API | `GET /public/catalogue`, `GET /public/products/:id`, `GET /public/blog`, `GET /public/blog/:slug`, `POST /public/inquiries`, `POST /public/order-proposals` (`routes/public.ts`). |
| Staff side | `routes/order-proposals.ts` (list, get, confirm, cancel) and `OrderProposalsView.tsx` in the ERP. Confirm mints an order in status `INQUIRY`, which then goes through normal confirmation. |
| Site | React + Vite. Pages: home, cakes, offers, courses, events, order, contact, about, blog, blog post. Catalogue and blog are read from the API (`lib/catalogue-api.ts`, `lib/blog-api.ts`). `blog-dashboard/` is a separate editor app. |
| Intake form | One shared component `EnquiryForm` for order, contact, courses and events. |

## A.2 Findings

Severity: **S1** exploitable or business-losing, **S2** wrong data or broken workflow, **S3** gap or hygiene.

### W-1 (S1) The website's forms never reach the ERP — Verified

The whole site makes exactly four network calls (`catalogue-api.ts`, two in `blog-api.ts`, one in the blog dashboard). A search for `public/inquiries`, `order-proposals` and `public/order` across both web apps returns **nothing**. The endpoints the audit praised exist, but nothing calls them.

What `EnquiryForm` does on submit:
- **Order form (`kind="cake"`)**: validates with zod, then opens `https://wa.me/256700935916?text=…` in a new tab and shows "Your order details are ready to send." If the customer closes the tab without pressing send, **the business never hears about it**.
- **Contact, courses and events forms**: validate, then call `setSent(true)` and show "Thanks for reaching out — we'll be in touch soon." **No request is made.** The message is discarded.

**Scenario.** A bride fills in the courses form and the events form and sees a success message. Nothing is stored, no notification fires, and no CRM record exists. She assumes you ignored her. The ERP's "inquiry → quote → order" funnel and "source performance" metrics (audit §4) can never include these leads because they never arrive.

Related: the WhatsApp number is hard-coded in the component source; the product `<select>` is a hard-coded list ("Strawberry Bliss", "Chocolate Dream", "Red Velvet Love", "Wedding cake", "Cupcake box") that is not read from the catalogue, so a name may not exist in the ERP; and `lib/cakery.ts` / the form do not send `productId`, options, allergies, delivery type or a reference image, although the server proposal endpoint supports most of those.

### W-2 (S1) The public endpoints are unprotected and trust the client — Verified

- `rateLimit` is imported only in `routes/auth.ts` (`claimRateLimit`). `public.ts` does not use it, and `index.ts` applies no global limiter. **No CAPTCHA, honeypot or per-contact limit.**
- `rateLimit` keys on `req.ip`, but `index.ts` never sets `app.set("trust proxy", …)`. Behind a reverse proxy every visitor shares the proxy's IP, so a limiter would throttle all users together or none. The limiter's `Map` is never pruned, so unique IPs grow memory without bound.
- Every inquiry **creates a customer** (`store.createCustomer`) when no exact email/phone match exists. A bot posting 5,000 forms creates 5,000 customers that then appear in CRM lists, reminders and analytics.
- If the posted email or phone matches an existing customer, the inquiry is **attached to that real customer's record** with attacker-chosen text (`subject`, `summary`, `details`). An unauthenticated visitor can write into a known customer's timeline.
- `channel` and `source` are taken from the request body (`channel || "Website"`, `source || "WEBSITE"`), so source attribution is client-controlled.
- `name`, `phone`, `email`, `details` are not length-capped on the inquiry path (only `subject` is `slice(0, 200)` and `summary` 500). The only bound is the 100 kb JSON limit.
- `POST /order-proposals`: `referenceImage` is stored as a free string (≤500 chars). `OrderProposalsView.tsx` does not render it anywhere, so even a legitimate image reference is invisible to staff. Number of lines is unbounded within 100 kb. `variantOptions` is free text (see catalogue doc CR-5).
- The proposal path prices correctly from the live catalogue, but `requiresQuote` products (e.g. the seeded wedding cake: note "Requires enquiry") are orderable at a flat price.
- `notifyNewInquiry` passes `{ userId: "public-website", role: "public", isAdmin: false }`. Whether anyone is actually notified depends on the role routing that the audit found broken (`Optim_notifications_audit.md`).

**Scenario.** A competitor's script posts 2,000 "cake" inquiries over a weekend. Monday: the CSR queue is buried, the customer list has 2,000 junk records, "customers this month" doubles, and the reminder scheduler (once built) would message the junk emails.

### W-3 (S1) Stored XSS in the blog, chained to token theft — Verified

- `src/pages/blog/blog-post.tsx` line 59: `<div className="blog-body" dangerouslySetInnerHTML={{ __html: post.body }} />`.
- A search of `server/` and both `package.json` files finds **no sanitisation** (`sanitize`, `DOMPurify`, `escapeHtml`). Posts are created through `POST /content/blog/posts` (`content.create`) and the body is stored as written.
- `GET /public/blog/:slug` returns `{ ...post, category }`, i.e. the whole stored post object, not a whitelisted shape.
- The blog dashboard keeps its session token in `localStorage` (`blog-dashboard/src/lib/blog-api.ts`, `TOKEN_KEY`).

**Chain.** Anyone who can create or edit a post (a content user, or an attacker who obtains such an account) can add `<img src=x onerror=…>`; every visitor, including logged-in staff browsing the public site on the same device, runs it. If the script runs on the same origin as a dashboard with a token in `localStorage`, it can read the token. The ERP token is a bearer token with no IP or device binding (`Optim_security_rbac.md`), so theft equals account takeover.

### W-4 (S2) The catalogue the site shows is incomplete and can be stale — Verified

- The site's `ErpProduct` type and `mapErpProduct` **drop `basePrice`**. Customers never see prices, so every enquiry starts with "how much?".
- Products map to a shared sprite photo (`SPRITE_POSITIONS`) unless `image` is an absolute `http(s)` URL. Seed rows use filenames like `chocolate-cake.jpg`, which fail the check.
- If the API is unreachable the site silently keeps its **seed catalogue** (`source: "seed"`), which can include products you have since archived or repriced. The UI can say so, but nothing prevents a customer ordering a stale item.
- `syncCatalogue` re-requests the whole catalogue on each mount after a 15-second TTL and the API sends no `Cache-Control` or `ETag`. With no rate limit this is also an amplification point.
- Product pages are not individually addressable (no slug), so there are no shareable product URLs, no per-product SEO and no structured data.

### W-5 (S2) No order tracking, no consent capture, no source attribution — Verified (absence)

- No tracking page or endpoint. Customers ask on WhatsApp "is my cake ready?".
- Forms have no marketing-consent checkbox or privacy notice link, and `customers` has no consent columns (`001_core.sql`). The reminder scheduler in `Optim_crm.md` cannot lawfully message people without this. (Check your obligations under Uganda's Data Protection and Privacy Act, 2019; I am not a lawyer.)
- No UTM or referrer capture; `inquiries.source` is a single text field set by the client.

### W-6 (S3) Browser-side security headers, CORS and storage — Verified

- `index.ts` sets `Access-Control-Allow-Origin: *` for the whole API including authenticated routes, and does not use `helmet` (no CSP, no `X-Content-Type-Options`, no `Referrer-Policy`).
- The `/api/v1` proxy in `vite.config.ts` is development/preview only. In production the site relies on `VITE_ERP_API_URL` and the wildcard CORS.

### W-7 (S3) Repo and build hygiene on the site — Verified

- `sweet-moments-cakery-web/erp/` contains `server/` and `sweet-moments-cakery/` folders that duplicate ERP code and can be mistaken for live code.
- `lint-final.json`, `supabase/config.toml` (the site talks to Express, not Supabase) and `tsconfig.tsbuildinfo` in `blog-dashboard/` are build or tooling leftovers.
- `robots.txt` allows everything, including `/blog-dashboard` if it is ever served from the same host, and there is no `sitemap.xml`.

### W-8 (S3) Website users versus customers — Verified

`routes/content.ts` manages `website-users` for the blog dashboard (staff-style accounts with `content.*` permissions). Customers have no accounts at all. The audit's "two identities" concern is therefore narrower than stated: no customer can log in, so there is no duplicate customer login to merge, but the name "website user" invites confusion and the table duplicates concepts in `users`.

---

# PART B — OPTIMISATION, CORRECTION AND IMPROVEMENT

## Build order for this module

| Step | Recommendation | Effort | Reason |
|---|---|---|---|
| 1 | W-R3 Sanitise blog HTML, stop token theft path | 0.5 day | Exploitable now. |
| 2 | W-R2 Abuse protection on public endpoints | 1–2 days | Must precede wiring forms, or bots find them immediately. |
| 3 | W-R1 Wire every form to the API | 2–3 days | Stops lead loss. |
| 4 | W-R4 Prices, options, stable catalogue | 1–2 days | Needs the catalogue doc R1/R4. |
| 5 | W-R6 Consent and attribution | 1 day | Needed before CRM reminders send. |
| 6 | W-R5 Order tracking | 1–2 days | Reduces WhatsApp status questions. |
| 7 | W-R7 Reference image upload | 1–2 days | Needs file storage decision. |
| 8 | W-R8 Headers, CORS, deployment | 0.5 day | |
| 9 | W-R9 Hygiene and SEO | 1 day | |

---

## W-R3 — Sanitise HTML and remove the token-theft path (fixes W-3)

### Server: sanitise on write **and** whitelist on read

```ts
// server/utils/sanitize-html.ts
import sanitizeHtml from "sanitize-html";

export const cleanBlogHtml = (html: string): string =>
  sanitizeHtml(html, {
    allowedTags: ["p","br","h2","h3","h4","ul","ol","li","strong","em","blockquote","a","img","figure","figcaption","hr"],
    allowedAttributes: { a: ["href","title","rel","target"], img: ["src","alt","width","height","loading"] },
    allowedSchemes: ["https", "mailto", "tel"],          // no javascript:, data: or http:
    allowedSchemesByTag: { img: ["https"] },
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }) },
    disallowedTagsMode: "discard",
  });
```

```ts
// server/routes/content.ts — in POST /blog/posts and PATCH /blog/posts/:id
const body = cleanBlogHtml(String(req.body.body ?? ""));
const post = store.createBlogPost({ ...pickBlogFields(req.body), body });   // whitelist fields instead of spreading req.body
```

```ts
// server/routes/public.ts — GET /blog/:slug: never spread the stored object
res.json({
  id: post.id, slug: post.slug, title: post.title, excerpt: post.excerpt,
  coverImage: post.coverImage, author: post.author, category: category?.name ?? "",
  publishedAt: post.publishedAt ?? post.createdAt, body: post.body,
});
```

### Backfill

Existing posts are stored unsanitised. Run once:

```ts
// server/scripts/sanitize-existing-posts.ts
for (const p of store.blogPosts()) { p.body = cleanBlogHtml(p.body); }
store.persist();
```

### Website: sanitise again at render (defence in depth)

```tsx
// sweet-moments-cakery-web/src/pages/blog/blog-post.tsx
import DOMPurify from "dompurify";
const safeBody = useMemo(() => DOMPurify.sanitize(post.body, { USE_PROFILES: { html: true } }), [post.body]);
<div className="blog-body" dangerouslySetInnerHTML={{ __html: safeBody }} />
```

### Dashboard token storage

Move the blog-dashboard session off `localStorage` (see `Optim_security_rbac.md`, session redesign). Until then: `sessionStorage` (cleared on tab close), a **short TTL** and a CSP on the dashboard host (`script-src 'self'`) so injected inline script cannot run. Serve the dashboard from a **different origin** than the public site so that public-page XSS cannot read its storage.

### Tests

```ts
it("strips script, event handlers and javascript: URLs from blog bodies", () => {
  expect(cleanBlogHtml('<p onclick="x()">a</p><script>1</script><a href="javascript:1">b</a>'))
    .toBe('<p>a</p><a rel="noopener noreferrer nofollow">b</a>');
});
it("public blog endpoint returns only whitelisted keys", async () => { /* assert no status/createdBy/etc. */ });
```

### UI

- **Blog dashboard editor**: replace any raw HTML textarea with a rich-text editor limited to the allow-list above (headings, lists, links, images), with a live "this is how it will look" preview.
- Link inserter validates `https://`; image inserter selects from uploads (W-R7) instead of free URLs.

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **RBAC** | `content.edit` becomes a trusted capability; add `content.publish` separate from `content.create` so a draft author cannot publish. | Permission rows; publish endpoint checks it. |
| **Audit** | Events `blog.created`, `blog.updated`, `blog.published`, with the sanitised diff size. | Event spine. |
| **Architecture** | Public read endpoints use whitelist DTOs everywhere (a shared `toPublic*` pattern, same as catalogue R1). | Convention + lint check. |

---

## W-R2 — Protect the public endpoints (fixes W-2)

### 1. Trust proxy and a real limiter

```ts
// server/index.ts
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));   // set to the number of proxies in front of Node
```

```ts
// server/middleware/rateLimit.ts — prune expired buckets and allow a custom key
export function rateLimit(opts: { max: number; windowMs: number; key?: (req: Request) => string }): RequestHandler {
  const buckets = new Map<string, Bucket>();
  setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k); },
              Math.min(opts.windowMs, 60_000)).unref();
  return (req, res, next) => {
    const k = opts.key ? opts.key(req) : (req.ip ?? "unknown");
    /* …same logic as today, keyed by k… */
  };
}
```

Because the limiter lives in process memory it resets on restart and does not span multiple instances; that is acceptable for one server. When you scale out, move it to Redis or Postgres (`Optim_architecture.md`).

### 2. Per-route limits, honeypot, time trap, CAPTCHA

```ts
// server/routes/public.ts
const perIp      = rateLimit({ max: 10, windowMs: 15 * 60_000 });
const perContact = rateLimit({ max: 3,  windowMs: 60 * 60_000,
  key: (req) => `c:${String(req.body?.email ?? req.body?.phone ?? "").toLowerCase().trim()}` });

router.post("/inquiries",       perIp, perContact, antiBot, handleInquiry);
router.post("/order-proposals", perIp, perContact, antiBot, handleProposal);
```

```ts
// server/middleware/anti-bot.ts
export const antiBot: RequestHandler = async (req, res, next) => {
  const b = req.body ?? {};
  if (b.website) return res.status(201).json({ ok: true });                          // honeypot: pretend success, store nothing
  const t = Number(b.formStartedAt);                                                  // ms epoch set when the form rendered
  if (!Number.isFinite(t) || Date.now() - t < 3_000) return res.status(429).json({ error: "Please try again" });
  if (process.env.TURNSTILE_SECRET) {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: String(b.captchaToken ?? ""), remoteip: req.ip ?? "" }),
    });
    const j = (await r.json()) as { success?: boolean };
    if (!j.success) return res.status(400).json({ error: "Verification failed" });
  }
  next();
};
```

Turnstile (or reCAPTCHA/hCaptcha) is the stronger control; the honeypot and time trap are free first layers. Verify any provider's current API before wiring it.

### 3. Strict schemas and server-decided fields

```ts
// server/routes/public.schemas.ts
export const inquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(30).regex(/^[+0-9 ()-]+$/).optional().default(""),
  email: z.string().trim().email().max(255).optional().default(""),
  kind: z.enum(["contact", "course", "event"]),
  subject: z.string().trim().min(2).max(200),
  details: z.string().trim().max(2000).default(""),
  consentMarketing: z.boolean().default(false),
  utm: z.object({ source: z.string().max(60), medium: z.string().max(60), campaign: z.string().max(80) }).partial().optional(),
  website: z.string().max(0).optional(),             // honeypot
  formStartedAt: z.number(), captchaToken: z.string().max(2000).optional(),
}).strict().refine((v) => v.phone || v.email, { message: "phone or email is required" });
```

`channel` and `source` are **set by the server** (`"Website"`, `"WEBSITE_CONTACT"` / `"WEBSITE_ORDER"` / `"WEBSITE_COURSE"` …), never read from the body.

### 4. Keep junk out of CRM and out of real customers' records

Do not attach unauthenticated input to an existing customer. Create the record as **unverified**, remember the possible match, and let staff decide.

```sql
-- 027_public_intake.sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS possible_duplicate_of TEXT REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by TEXT;
-- customers.status is existing free text ('Active'); add the value 'Unverified' (no schema change needed).
-- Backfill: everything already there counts as verified.
UPDATE customers SET verified_at = created_at WHERE verified_at IS NULL AND status <> 'Unverified';

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS utm_source TEXT, ADD COLUMN IF NOT EXISTS utm_medium TEXT, ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,                 -- sha256(ip + daily salt); never store raw IP unless you need to
  ADD COLUMN IF NOT EXISTS spam_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_proposals
  ADD COLUMN IF NOT EXISTS utm_source TEXT, ADD COLUMN IF NOT EXISTS utm_medium TEXT, ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash TEXT, ADD COLUMN IF NOT EXISTS spam_score INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_customers_unverified ON customers(created_at) WHERE status = 'Unverified';
```

```ts
function resolveCustomerForPublic(name: string, phone: string, email: string) {
  const match = matchCustomer(email, phone);                     // existing helper, exact match only
  // NEVER attach to `match`; create an unverified record that points at it.
  return store.createCustomer({
    name, phone, email, source: "Website", status: "Unverified",
    possibleDuplicateOf: match?.id ?? null,
    notes: "Auto-created from the public website. Verify before use.",
  });
}
```

Staff action **Verify** either marks the customer verified, or **Merge into existing** (which re-points the inquiry, proposals and orders and deletes the unverified row; `Optim_crm.md` owns the merge tool). A nightly job deletes `Unverified` customers with no linked inquiry that is still `NEW` after 30 days.

### Tests

1. 11th post from one IP in 15 minutes returns 429; the 4th for the same email in an hour returns 429.
2. A filled honeypot returns 201 but writes no inquiry and no customer.
3. A body containing `channel`, `source` or unknown keys returns 400.
4. A post with an existing customer's phone creates an `Unverified` customer with `possibleDuplicateOf` set and does **not** change the existing customer's inquiries.
5. Behind `trust proxy`, two requests with different `X-Forwarded-For` get separate buckets.

### UI (ERP) — new and adjusted

- **New: "Website inbox"** (CRM → Inquiries filter, or a tab on `OrderProposalsView`): rows with source, UTM campaign, spam score, matched-customer hint ("Possible duplicate of Amara K."), and actions **Accept** (verify customer, keep inquiry), **Merge into existing**, **Mark as spam** (sets status, trains a simple blocklist of email/phone/IP-hash), **Reply on WhatsApp** (prefilled `wa.me` link).
- **Adjusted: Customers list** hides `Unverified` customers by default; a "Needs verification (n)" chip shows them.
- **Adjusted: `OrderProposalsView.tsx`**: show the possible duplicate, the reference images (W-R7), allergies and the consent flag.

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **CRM** | Lists, segments, reminders and exports exclude `Unverified`; consent stored per customer (W-R6); merge tool added. | `WHERE status <> 'Unverified'` in the store accessors; `Optim_crm.md`. |
| **Analytics** | Funnel and source-performance use `utm_*` and exclude spam-scored rows; "new customers" counts only verified. | `fact_inquiries` filters. |
| **Notifications** | `inquiry.created` goes to CRM/CSR holders of `inquiries.view`; digest instead of one alert per spam hit when volume spikes. | Rule with `dedupe_minutes`. |
| **Audit** | `public.inquiry_received`, `public.proposal_received`, `customer.verified`, `customer.merged`, `public.blocked` (rate or CAPTCHA). | Event spine. |
| **Security/RBAC** | Public routes are a documented, **explicit** allow-list in the router; everything else denies by default. | `Optim_security_rbac.md`. |
| **Orders** | `POST /order-proposals/:id/confirm` must refuse to create an order for an `Unverified` customer until verified. | Add a guard. |

---

## W-R1 — Wire every form to the API (fixes W-1)

### Design

All forms submit to the API **first**. WhatsApp becomes an optional follow-up after a successful submission, carrying the reference number, so the business has the record even if the customer never presses send.

### Server

- `POST /public/inquiries` (contact, courses, events) — exists; apply W-R2.
- `POST /public/order-proposals` — exists; extend the schema to accept `optionValueIds`, `allergies`, `deliveryType`, `deliveryLocation`, `referenceUploadIds`, `consentMarketing`.
- Both return a **reference** (`proposalNumber` or inquiry id) and, for proposals, a `trackingToken` (W-R5).

```ts
// extended proposal line, validated against the live catalogue AND the catalogue doc's priceLine()
const line = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
  optionValueIds: z.array(z.string()).max(10).default([]),
});
export const proposalSchema = z.object({
  customerName: z.string().trim().min(2).max(150),
  phone: z.string().trim().max(30).default(""), email: z.string().trim().email().max(255).or(z.literal("")).default(""),
  items: z.array(line).min(1).max(20),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferredTime: z.string().max(20).default(""),
  deliveryType: z.enum(["PICKUP", "HOME_DELIVERY"]),
  deliveryLocation: z.string().max(300).default(""),
  allergies: z.array(z.string().max(40)).max(10).default([]),
  customerNotes: z.string().max(2000).default(""),
  referenceUploadIds: z.array(z.string()).max(5).default([]),
  consentMarketing: z.boolean().default(false),
  /* + honeypot, formStartedAt, captchaToken, utm as in W-R2 */
}).strict();
```

Pricing runs through `priceLine()` (catalogue doc R4). A line whose product has `requiresQuote` is **accepted as a quote request**: it creates the proposal with `total = null` and the message "We'll send you a quote", not an orderable price. Lead time: reject a `preferredDate` earlier than today + `products.lead_time_hours` of the slowest line (return the earliest allowed date in the error so the form can show it).

### Website client

```ts
// sweet-moments-cakery-web/src/lib/intake-api.ts
import { catalogueApiBase } from "./catalogue-api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${catalogueApiBase}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error ?? `Request failed (${res.status})`), { status: res.status });
  return json as T;
}
export const submitInquiry  = (b: InquiryPayload)  => post<{ id: string; message: string }>("/public/inquiries", b);
export const submitProposal = (b: ProposalPayload) => post<ProposalResult>("/public/order-proposals", b);
```

```tsx
// enquiry-form.tsx (changed behaviour, abridged)
const startedAt = useRef(Date.now());
async function submit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  /* …zod validation as today… */
  setBusy(true); setError("");
  try {
    const result = kind === "cake" ? await submitProposal(toProposal(parsed.data, startedAt.current))
                                   : await submitInquiry(toInquiry(parsed.data, kind, startedAt.current));
    setRef(result);                      // show reference number + tracking link
    setSent(true);
  } catch (err) {
    setError(friendly(err));            // 429 -> "Too many requests, try later"; 400 -> field messages; network -> "Could not send. Your details are kept; try again or WhatsApp us."
  } finally { setBusy(false); }
}
```

The success state shows: reference number, what happens next ("we reply within X hours"), a **Track your request** link, and an optional **Continue on WhatsApp** button whose prefilled text begins with the reference number. If the network call fails, offer WhatsApp as the fallback path, never as the only path.

### UI — website

- **Order form (adjusted):** product picker built from the live catalogue (grouped by category, with image and "from UGX …" price); **options** per product (size, flavour) from the catalogue; **allergy chips** (eggs, nuts, dairy, gluten, other); delivery choice with an address field and, if you adopt zones, a fee preview; date picker that disables dates before the minimum lead time; reference-image upload (W-R7); marketing-consent checkbox (**unticked**) with privacy-policy link; running **estimated total** with the note "Final price confirmed by our team".
- **Contact / courses / events (adjusted):** same component, `kind`-specific subject lists, honeypot field hidden with CSS (not `type=hidden`), submit button disabled while sending, inline errors, success state with reference.
- **New: `/privacy` page** and footer link; **new: `/track`** (W-R5).
- WhatsApp number moves to `VITE_WHATSAPP_NUMBER` (or a `GET /public/settings` response) instead of source code.

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **Catalogue** | Supplies options, prices, lead time, `requiresQuote`, allergens (`Optim_catalogue_recipes.md` R4, R6, R7). | `priceLine()`, public DTO. |
| **Orders** | Proposal confirm copies `selected_options`, allergies and delivery details onto the order; the allergen-conflict check from catalogue R6 runs at confirm. Order `source` = proposal source. | Extend `/order-proposals/:id/confirm`. |
| **Quotations** | A `requiresQuote` proposal can be converted into a **quotation** instead of a draft order. | New action "Create quotation" on `OrderProposalsView`. |
| **CRM** | Inquiry created with UTM and consent; allergies saved to the customer's preference record on verification. | `Optim_crm.md`. |
| **Notifications** | New proposal → Sales and CSR; unanswered after 1 h → escalate at 4 h (audit rule). Customer confirmation by WhatsApp/email only when consent and a provider exist. | Rules. |
| **Production** | Allergies and options appear on the daily production sheet once confirmed. | Order fields. |
| **Analytics** | Funnel starts at `public.proposal_received`; conversion by source and campaign. | `fact_inquiries`, milestones `inquiry_received`. |
| **Finance** | None until an order exists. Optional later: online deposit payment link (MoMo/Airtel) on the tracking page. | `PaymentProvider` abstraction (`Optim_finance.md`). |

### Database

Covered in `027_public_intake.sql` plus:

```sql
-- 028_proposal_details.sql
ALTER TABLE order_proposals
  ADD COLUMN IF NOT EXISTS allergies TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS consent_marketing BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tracking_token TEXT,
  ADD COLUMN IF NOT EXISTS requires_quote BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS ux_order_proposals_tracking ON order_proposals(tracking_token) WHERE tracking_token IS NOT NULL;
ALTER TABLE order_proposal_items ALTER COLUMN unit_price DROP NOT NULL, ALTER COLUMN total DROP NOT NULL;  -- NULL = priced by quote
```

---

## W-R4 — A catalogue that shows prices and is never silently stale (fixes W-4)

### Server

- Public DTO includes `basePrice`, `currency`, `slug`, `serves`, `leadTimeHours`, `requiresQuote`, `allergens`, `dietaryTags`, `options[]` (grouped, with `priceDelta`) and `images[]`. Never `costReference`, `notes`, `sku`, `recipe*`.
- Send `Cache-Control: public, max-age=60` and a weak `ETag` from `max(updated_at)` so clients revalidate cheaply.

```sql
-- 029_product_slugs.sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;
UPDATE products SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || right(id, 4) WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_slug ON products(slug);
```

### Website

```ts
// catalogue-api.ts — extend the type and mapper
export interface ErpProduct { /* …existing… */ basePrice?: number; currency?: string; slug?: string;
  requiresQuote?: boolean; leadTimeHours?: number; serves?: string; allergens?: string[]; options?: ErpOptionGroup[]; }
```

- Replace the **seed fallback** with a last-known-good cache: on a successful sync, store `{ products, syncedAt }` in `localStorage` (**non-sensitive data only**); on failure show that copy with a banner "Showing prices from 2 days ago; ordering is temporarily limited", and disable the order button if the copy is older than 24 hours. Remove invented seed products from production builds.
- Add `/cakes/:slug` product pages with Open Graph tags and `Product` JSON-LD (name, image, offers with price and currency). Generate `sitemap.xml` from the catalogue at build or on the server.
- Product cards show "From UGX 45,000" (lowest option combination) or "Request a quote".

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **Catalogue** | Slugs, featured flag, display order, images (catalogue R7/R8). | Admin UI editing of slug with a uniqueness check. |
| **Analytics** | Page and product views are tracked by a privacy-friendly analytics script (Plausible/Umami or your choice), tagged with UTM; product popularity compared with ordered volume. | Site configuration, no ERP code. |
| **Orders** | Product page "Order this cake" pre-fills the order form via `?cake=<slug>` (the form already reads `cake` from the query; change it to a slug and validate against the catalogue). | `order.tsx` schema update. |

---

## W-R6 — Consent and source attribution (fixes W-5, consent half)

```sql
-- 030_consent.sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS marketing_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_sms      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_email    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_updated_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS consent_log (
  id BIGSERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','sms','email')),
  granted BOOLEAN NOT NULL,
  source TEXT NOT NULL,                 -- 'website_form' | 'staff' | 'opt_out_reply' | 'unsubscribe_link'
  text_version TEXT NOT NULL,           -- version of the consent wording shown
  ip_hash TEXT, actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_log_customer ON consent_log(customer_id, created_at DESC);
```

- The website consent checkbox is **unticked by default**, worded separately per use ("Remind me about next year's celebration by WhatsApp"), and **not required** to submit.
- When a customer is verified, consent from the submission is copied to the customer columns and a `consent_log` row is written. Transactional messages (order confirmation, pickup ready) do not need marketing consent but should be listed in the privacy notice.
- Every outbound reminder includes opt-out wording ("Reply STOP"); an inbound STOP (or staff action) sets the channel to false and logs it.

### UI

- **Website:** consent checkbox per channel on the order form; privacy page; unsubscribe page `/unsubscribe?t=<token>`.
- **ERP, customer profile (adjusted):** consent panel with channel toggles, last updated, history drawer from `consent_log`.
- **ERP, reminders list (adjusted):** reminders for a customer without consent show "No consent — contact manually only if the customer initiated" and the send button is disabled.

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **CRM** | The reminder scheduler (`Optim_crm.md`) selects only customers with consent for the chosen channel. | `WHERE marketing_whatsapp`. |
| **Notifications** | Consent withdrawal event → CRM owner; delivery records respect consent. | `notification.suppressed_no_consent` event. |
| **Analytics** | Consent rate, opt-out rate; reminder conversion measured only on consenting audience. | Metrics. |
| **Audit** | Consent changes are append-only in `consent_log`; also emitted as events. | Event spine. |

---

## W-R5 — Order tracking (fixes W-5, tracking half)

### Server

```sql
-- 031_order_tracking.sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_token TEXT;
UPDATE orders SET public_token = encode(gen_random_bytes(16), 'hex') WHERE public_token IS NULL;   -- needs pgcrypto, else use md5(random()::text||id)
CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_public_token ON orders(public_token);
```

(`gen_random_bytes` needs the `pgcrypto` extension; the schema already uses `gen_random_uuid()`, which is built in from PostgreSQL 13. If you prefer, generate the token in Node with `crypto.randomBytes(16).toString("hex")` in a backfill script.)

```ts
// server/routes/public.ts
const STAGE: Record<string, string> = {         // internal OrderStatus (database/types.ts) -> what the customer sees
  INQUIRY: "Request received", QUOTATION: "Quote being prepared", AWAITING_CONFIRMATION: "Awaiting your confirmation",
  CONFIRMED: "Order confirmed", PRODUCTION_REVIEW: "Order confirmed", READY_FOR_PRODUCTION: "Scheduled for baking",
  IN_PRODUCTION: "Being baked", QUALITY_CHECK: "Final checks", REWORK_REQUIRED: "Final checks",
  READY_FOR_DELIVERY: "Ready", IN_TRANSIT: "On its way", AWAITING_COLLECTION: "Ready for collection",
  COMPLETED_DELIVERED: "Delivered", CANCELLED: "Cancelled",
};
router.get("/track/:token", rateLimit({ max: 30, windowMs: 15 * 60_000 }), (req, res) => {
  const o = store.orders().find((x) => x.publicToken === String(req.params.token));
  if (!o) return res.status(404).json({ error: "Not found" });                    // same response whether or not it exists
  res.json({ orderNumber: o.orderNumber, stage: STAGE[o.status] ?? "In progress",
             requiredBy: o.requiredBy, deliveryType: o.deliveryStatus, updatedAt: o.updatedAt });
});
// Lookup without the link: POST /public/track { orderNumber, phoneLast4 } (rate limited harder), same response shape.
```

Return **no** names, addresses, amounts or notes. The map covers every value of `OrderStatus` in `database/types.ts` (verified); add the new states if you introduce any (for example `PARTIALLY_PAID` is a payment status, not an order status, and should not appear here). Note that `REWORK_REQUIRED` is deliberately shown as "Final checks" so internal quality failures are not exposed.

### Website

- **`/track`**: input for order number + last 4 digits of phone, or open directly from a link `/track/<token>`. A progress bar of stages with timestamps and, when delivery applies, the delivery window. Print-friendly; works offline from the last result.

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **Orders** | Generate `public_token` at creation (`createOrder`); regenerate action for staff; show the tracking link and copy button on the order detail. | `Optim_orders.md`. |
| **Notifications** | Optional customer messages ("Your cake is ready") on status change, **only** with consent/transactional basis and a configured provider; otherwise a one-click `wa.me` link for staff. | `NotificationChannel` interface. |
| **Deliveries** | Dispatch and delivery events update the tracking stage and ETA. | `Optim_deliveries.md`. |
| **Finance** | Later: balance due and a "Pay now" action on the tracking page through the provider abstraction. | `Optim_finance.md`. |
| **Analytics** | Tracking-page views reduce "status query" interactions; count them as a metric. | Interactions log. |

---

## W-R7 — Reference image upload (fixes the `referenceImage` gap)

The current field is a 500-character string that no screen displays. Replace it with real, validated uploads shared by the website, proposals, orders, blog and product gallery.

```sql
-- 032_uploads.sql
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,         -- key in object storage / uploads dir, never a user-supplied name
  mime TEXT NOT NULL, bytes INTEGER NOT NULL, width INTEGER, height INTEGER,
  sha256 TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('proposal_reference','order_reference','order_result','product','blog')),
  uploaded_by TEXT,                          -- user id, or NULL for public
  ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ATTACHED','REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_proposal_uploads (proposal_id TEXT REFERENCES order_proposals(id) ON DELETE CASCADE, upload_id TEXT REFERENCES uploads(id), PRIMARY KEY (proposal_id, upload_id));
CREATE TABLE IF NOT EXISTS order_uploads (order_id TEXT REFERENCES orders(id) ON DELETE CASCADE, upload_id TEXT REFERENCES uploads(id), kind TEXT NOT NULL DEFAULT 'reference', PRIMARY KEY (order_id, upload_id));
CREATE TABLE IF NOT EXISTS product_images (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, upload_id TEXT NOT NULL REFERENCES uploads(id), alt TEXT NOT NULL DEFAULT '', display_order INT NOT NULL DEFAULT 0);
```

```ts
// server/routes/public.ts
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
router.post("/uploads", perIp, antiBot, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file required" });
  const type = await fileTypeFromBuffer(req.file.buffer);                       // magic bytes, not the extension or client MIME
  if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type.mime))
    return res.status(415).json({ error: "JPEG, PNG or WebP only" });
  const img = sharp(req.file.buffer).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }); // re-encode strips EXIF/GPS and payloads
  const { data, info } = await img.toBuffer({ resolveWithObject: true });
  const id = crypto.randomUUID(); const key = `uploads/${id}.webp`;
  await storage.put(key, data, "image/webp");                                    // local dir in dev; S3-compatible bucket in prod
  await pool.query(`INSERT INTO uploads (id, storage_key, mime, bytes, width, height, sha256, purpose, ip_hash)
                    VALUES ($1,$2,'image/webp',$3,$4,$5,$6,'proposal_reference',$7)`,
                   [id, key, info.size, info.width, info.height, sha256(data), hashIp(req.ip)]);
  res.status(201).json({ id });
});
```

- Pending uploads not attached to a proposal within 24 hours are deleted by the nightly job.
- Staff read via an authenticated `GET /uploads/:id` (signed, short-lived URL), not a public path. Public site images (product, blog) are served through the CDN path.
- The 100 kb JSON limit stays; uploads use multipart so it does not apply to them.

### UI

- **Website:** drag-and-drop or camera picker (up to 3 images), thumbnail with remove, progress, clear errors ("Image must be JPEG/PNG/WebP, 5 MB or less").
- **ERP, proposals and order detail (new):** reference gallery with lightbox; a **"Finished cake"** upload slot at the QC/ready stage. Photos appear on the production sheet and, with consent, can be flagged "portfolio-eligible".
- **ERP, catalogue (adjusted):** product gallery uses the same component (catalogue doc R8).

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **Production** | Reference photos on job card and printed daily sheet; QC step captures the result photo. | `Optim_production.md`. |
| **Orders** | `order_uploads`; photo timeline on the order. | `Optim_orders.md`. |
| **CRM** | Customer timeline shows past designs (and powers "repeat last year's cake"). | `Optim_crm.md`. |
| **Catalogue** | Gallery and cover image (`products.image` stays as the cover URL). | catalogue R8. |
| **Notifications** | None required. | n/a |
| **Architecture** | Introduce a `storage` interface (local/S3) and backups that include the bucket. | `Optim_architecture.md`. |

---

## W-R8 — Headers, CORS and deployment (fixes W-6)

```ts
// server/index.ts
import helmet from "helmet";
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));

const allowed = (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isPublic = req.path.startsWith("/api/v1/public");
  if (origin && (allowed.includes(origin) || (isPublic && process.env.PUBLIC_SITE_ORIGINS?.split(",").includes(origin)))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Idempotency-Key");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
```

- Add a CSP for the website host (`default-src 'self'`; allow your image/CDN host and the Turnstile script) and for the dashboard host.
- Serve the public site, the ERP and the blog dashboard from **separate origins** (for example `www.`, `app.`, `studio.`), so a bug on the public site cannot read the staff apps' storage.
- `robots.txt`: disallow the ERP and dashboard hosts entirely (and add `noindex` headers there); keep the public site indexable with a sitemap line.

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **Security/RBAC** | Same CORS/helmet change covers the whole API; `Optim_security_rbac.md` owns the full session and header policy. | Single middleware. |
| **Architecture** | Environment variables documented in `.env.example`: `CORS_ORIGINS`, `PUBLIC_SITE_ORIGINS`, `TRUST_PROXY_HOPS`, `TURNSTILE_SECRET`, `VITE_WHATSAPP_NUMBER`. | Update example and README. |
| **Deployments** | Health check keeps `/health`; add a status endpoint check for the site build. | CI. |

---

## W-R9 — Hygiene, SEO and content (fixes W-7, W-8)

- **Delete** `sweet-moments-cakery-web/erp/` after a `diff -r` against `server/` confirms nothing unique is in it; remove `lint-final.json`, `blog-dashboard/tsconfig.tsbuildinfo`, and `supabase/config.toml` (or document why it exists). Add `*.tsbuildinfo` to `.gitignore`.
- **SEO:** unique `<title>`/description per page (already via `usePageMeta`), Open Graph and canonical tags, `sitemap.xml`, `Product` and `LocalBusiness` JSON-LD, descriptive `alt` text, image dimensions and `loading="lazy"`; blog posts get `Article` JSON-LD.
- **Content:** rename "website users" to **content authors** in the ERP UI and treat them as restricted staff accounts (a `content-author` role with `content.create` and `content.edit` but not `content.publish`).
- **Offers page:** read offers from the ERP (a small `promotions` table with start/end dates) instead of static copy, so expired offers stop appearing; apply the discount through `priceLine()` rather than text.
- **Accessibility:** form labels are present; add error summaries, focus management after submit, colour-contrast check, and keyboard operation for the product picker.

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **Catalogue** | Promotions linked to products/categories; price shown as struck-through original plus offer price. | New `promotions` table owned by catalogue; priced server-side. |
| **Orders** | Order lines record `promotion_id` and discount so finance can report discounts given. | `Optim_orders.md` discount fields. |
| **Analytics** | Offer performance (orders with a promotion, margin impact). | `fact_order_lines`. |
| **RBAC** | `content.publish`, `promotions.manage`. | Permission rows. |

---

# PART C — CONSOLIDATED VIEW

## C.1 API changes

| Endpoint | Change |
|---|---|
| `POST /public/inquiries` | Schema-strict, rate limited, anti-bot, server-set `source`, creates `Unverified` customer, returns reference. |
| `POST /public/order-proposals` | Adds options, allergies, uploads, consent, `requiresQuote`, tracking token; prices via `priceLine()`. |
| `POST /public/uploads` | **New.** Image validation and re-encoding. |
| `GET /public/track/:token`, `POST /public/track` | **New.** Minimal status. |
| `GET /public/catalogue`, `/products/:id` | Whitelist DTO, prices, options, slug, cache headers, hidden categories excluded. |
| `GET /public/blog/:slug` | Whitelist DTO, sanitised body. |
| `POST/PATCH /content/blog/posts` | Server-side sanitising, field whitelist, `content.publish` for publishing. |

## C.2 UI summary

| Surface | New | Adjusted |
|---|---|---|
| Website | `/track`, `/privacy`, `/unsubscribe`, product pages `/cakes/:slug`, upload widget, option pickers, consent checkboxes, estimated total | `EnquiryForm` (submits to API, honeypot, error states, success with reference), order page (catalogue-driven product list), cake cards (prices), blog post (sanitised render) |
| Blog dashboard | Restricted rich-text editor, publish gate | Token storage (session-scoped, short TTL) |
| ERP | Website inbox, consent panel, reference gallery, duplicate/merge actions | `OrderProposalsView` (images, allergies, duplicates), Customers list (`Unverified` filter), customer profile |

## C.3 Migration summary

| File | Contents |
|---|---|
| `027_public_intake.sql` | Unverified/duplicate support, UTM, ip hash, spam score |
| `028_proposal_details.sql` | Allergies, consent flag, tracking token, quote flag, nullable prices |
| `029_product_slugs.sql` | Slugs and uniqueness |
| `030_consent.sql` | Consent columns and `consent_log` |
| `031_order_tracking.sql` | `orders.public_token` |
| `032_uploads.sql` | Uploads, attachments, product images |

Every statement is idempotent. Back up first and test on a copy. `027`–`032` must be applied after the catalogue file's `022`–`026` if both are adopted, or renumbered consistently with the other module files.

## C.4 Tests to write (in order)

1. Sanitiser strips scripts, handlers and `javascript:`; blog API returns only whitelisted keys.
2. Public routes rate limit (IP and contact), honeypot, unknown-key rejection, `trust proxy` keying.
3. Public inquiry never alters an existing customer; creates an `Unverified` record pointing at the match.
4. Proposal pricing equals `priceLine()` output; a `requiresQuote` product yields no price; a too-early date is rejected with the earliest allowed date.
5. Upload rejects a renamed `.exe`/SVG/oversized file; stored file is WebP with no EXIF.
6. Tracking endpoint returns identical 404s for unknown and malformed tokens and exposes no personal data.
7. Frontend: form shows an error and keeps the user's input when the API call fails; success shows the reference; the honeypot is never visible.
8. Consent: unticked by default; withdrawal writes a `consent_log` row and disables reminder sending.

## C.5 Rollout plan

1. **Day 1:** W-R3 (sanitiser + backfill) and the tracking of dashboard token handling.
2. **Week 1:** W-R2 then W-R1 behind a flag (`PUBLIC_INTAKE_ENABLED`); run the form side by side with WhatsApp for a week and compare counts to catch drops.
3. **Week 2:** W-R4 and W-R6, then publish the privacy page.
4. **Week 3+:** W-R5 tracking, W-R7 uploads (decide storage first), W-R8 headers/CORS cut-over (test all three front ends against the allow-list before enabling), W-R9 hygiene.

## C.6 Open points I could not verify

- Production topology (reverse proxy, number of hops, whether the site and API share an origin). The `trust proxy` value and CORS list depend on it.
- `store.createBlogPost` and `updateBlogPost` take a loose `Patch` object (verified they exist at `store.ts` ~1893 and ~1916), so the whitelist `pickBlogFields` is yours to define. Likewise `store.createCustomer(input: Patch)` is loosely typed: confirm it actually persists `status` and the new `possibleDuplicateOf` field and add them to the customer mapper and write-back column list.
- Whether `blog-dashboard` is deployed from the same origin as the public site today; if so, separating origins is the most valuable single mitigation after sanitising.
- Runtime behaviour of everything above: I did not run the app, and I could not install the new dependencies here.
