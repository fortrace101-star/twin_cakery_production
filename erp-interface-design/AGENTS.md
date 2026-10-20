## Application architecture
- Use React + Vite + TypeScript with react-router-dom (`/` dashboard, `/workspace/:module` modules) and shared ERP components, because all modules share navigation and interaction patterns.
- Keep demo records in a client-side shared workspace provider without persistent storage until the Express + Postgres backend is wired, because this delivery is an interface prototype, not a connected ERP.
- Preserve the complete supplied business specification in docs as the reference for future live workflows.
- Backend lives in `erp/server` (Express + TypeScript, REST under `/api/v1`); local Postgres database `twin_cakery` is the single source of truth (raw `pg`, SQL migrations in `server/migrations`, seeds in `server/seeds`).

### Running the Phase F hardening gate
- The gate `server/_f_gate.ps1` boots its own API instance, primes the full security/audit/pagination/e2e matrix (S0–S8 = 96 assertions), and prints `GATE_RESULT fail=0` on success.
- It sets `[Net.ServicePointManager]::SecurityProtocol` and raises the **HTTP connection limit to 50** (`[System.Net.ServicePointManager]::DefaultConnectionLimit = 50`) because PS 5.1 defaults to **2** — which serialises concurrent probes and false-fails the concurrent pagination + role probes (S0–S8).
- Server writes on the dev box run ~1–2 s each (full in-memory cache flush per persist), so `POST /orders/:id/confirm` internally persists ~6 times and can take up to ~20 s; the gate's `Req()` helper uses a 45 s timeout for that reason.
- Frontend: `npm test` (vitest) + `npm run build` only. Backend type-checks via `tsc -p server/tsconfig.json --noEmit` (server/tsconfig.json had a latent duplicate `strict` key — removed; it made vite's tsconfig loader reject server files).
