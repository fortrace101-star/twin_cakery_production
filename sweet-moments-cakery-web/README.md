# Sweet Moments Cakery

A Twin Cakery website built with React, Vite and TypeScript for client orders and information
about Twin Cakery, offers, courses and upcoming events.

UI references:

- https://cdn.dribbble.com/userupload/46314113/file/21bc98b798612b446c18893645f8c63c.png?resize=2048x1536&vertical=center
- https://cdn.dribbble.com/userupload/46314115/file/83bdc4c66d3f0a0cb5c701ad3afa3b4b.png?resize=2048x12291&vertical=center
- https://dribbble.com/shots/27226164-Bakery-Website

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
npm i
npm run dev
```

Other scripts:

```sh
npm run build     # production build to dist/
npm run preview   # serve the production build
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run test      # vitest
```

## Catalogue synchronisation

The public catalogue ("Our cakes", the home page grid) is read live from the Twin Cakery ERP:

```http
GET {VITE_ERP_API_URL}/public/catalogue   ->   { categories, products, featured }
```

- The endpoint is public (no auth), and the API sends `Access-Control-Allow-Origin: *`.
- `VITE_ERP_API_URL` defaults to `/api/v1`. The Vite dev and preview servers proxy that path to
  `http://localhost:4000`, where the ERP API runs — so local development works with no
  configuration. Point at a deployed ERP with an absolute URL instead, e.g.
  `VITE_ERP_API_URL=https://erp.example.com/api/v1`.
- Only rows the ERP marks active and `catalogueVisible` are shown, so hiding a product in the ERP
  hides it here on the next sync.
- If the ERP is unreachable the site keeps its built-in starter menu and says so on the page,
  rather than rendering an empty grid.

Start the API alongside its database:

```sh
cd ../erp-interface-design
npm run db:migrate   # once
npm run db:seed      # once — seeds categories, 6 products, inventory, orders
npm run dev:api      # API on http://localhost:4000
```

Writes stay in the ERP: creating, editing and archiving products require an authenticated session
with the `catalogue.create` / `catalogue.edit` / `catalogue.archive` permissions, so the public site
is read-only by design.
