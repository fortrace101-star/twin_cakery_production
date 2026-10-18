## Application rules

- Use the React + Vite + TypeScript stack with `src/app.tsx` as the client entry and a separate public route for each content section, so links remain shareable and each page has its own metadata.
- Keep shared brand navigation and footer in the root layout (`src/router.tsx`) and reusable bakery sections in components/cakery, so all pages retain a consistent experience.
- Order requests open WhatsApp directly from the browser; client-side zod validation is the only gate, so never treat a form submission as a confirmed order or payment.
- Keep unconfirmed course dates, offers, event dates, and pricing unlisted until supplied by the business, so illustrative content does not become a false promise.
