## Application architecture
- Use React + Vite + TypeScript with react-router-dom (`/` dashboard, `/workspace/:module` modules) and shared ERP components, because all modules share navigation and interaction patterns.
- Keep demo records in a client-side shared workspace provider without persistent storage until the Express + Postgres backend is wired, because this delivery is an interface prototype, not a connected ERP.
- Preserve the complete supplied business specification in docs as the reference for future live workflows.
- Backend lives in `erp/server` (Express + TypeScript, REST under `/api/v1`); local Postgres database `twin_cakery` is the single source of truth (raw `pg`, SQL migrations in `server/migrations`, seeds in `server/seeds`).
