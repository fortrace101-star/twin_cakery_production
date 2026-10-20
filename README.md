# twin_cakery_production
Repo tree: `erp/erp-interface-design` (React+Vite+TS frontend) and `erp/server` (Express+TS backend on `:4000`, REST at `/api/v1`, Postgres `twin_cakery`). See `AGENTS.md`, `PROGRESS.md`, `IMPLEMENTATION_PLAN.md`.

## Running the Phase F hardening gate
From a shell at the repo root:
1. Ensure local Postgres is up and seeded (`cd server; npm run db:migrate db:seed`).
2. Run `powershell -File server/_f_gate.ps1`.
3. It boots its own API, runs the full matrix (§35 security sweep, §27 leak tests, §33 pagination, §34 audit coverage, snapshot immutability, + critical-path E2E), then prints:
   ```
   GATE_RESULT fail=0
   ```
   and exits `0`. Any non-zero / `fail=1` lines are logged as `FAIL …` above it.
Prereqs baked into the script: raises the HTTP connection limit to 50 (PS 5.1 default 2 false-fails concurrent probes), 45 s per-request timeout (write-heavy `confirm` persists ~6× ≈ 20 s), and a FK-safe pre-clean that wipes prior gate rows before boot.