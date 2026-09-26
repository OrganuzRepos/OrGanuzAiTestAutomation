---
name: organuz-run-tests
description: Run the Organuz Playwright suites (ui / organuz-api / product) against the right target and environment, including the local FastAPI+Grafana stack. Use when asked to run tests, run a specific project, switch environment, or debug the local server stack / port conflicts.
---

# Running the Organuz test suites

The default `npx playwright test` runs **110 tests** (all green): `product` 37 + `local-web` 50 + `security` 20 + `agent` 2 + `organuz-api` 1. With `MONITORING_ENABLED=true` the opt-in `monitoring` project adds 50 live checks → **160 total**.

> **⚠️ Some projects are CURRENTLY DISABLED** — `chromium`, `product-setup`, and `product-authenticated` are commented out in `playwright.config.ts` (spec files retained; re-enable by uncommenting). While disabled, `npx playwright test --project=chromium` (or `--project=product-authenticated`) reports "no tests". The rows for them below apply once re-enabled. `product` is **active again**; `security` and `local-web` are **active** projects.

The main project targets:

| Project | testMatch | Target |
|---|---|---|
| `product` *(active)* | `tests/product/**` (excl. `flows/**`) | Product app — `QA_TARGET_ENV` (default **dev** `dev1.app.organize.organuz.com`) |
| `local-web` *(active, local-only)* | `tests/local-web/**` | Local marketing-site e2e vs prod `www.organuz.ai`; every spec self-skips when `CI` is set, and the CI matrix omits this project |
| `security` *(active)* | `tests/security/**` | Authorized, non-destructive pentest of the Organuz Supabase backend (public anon key, browserless); a failure is a real finding. Runs in CI |
| `organuz-api` *(active)* | `tests/organuz-api/**` (`@other-smoke`) | Organuz Supabase backend (`/rest/v1/projects`, edge functions) |
| `agent` *(active)* | `tests/agent/**` (`@other-smoke`) | QA-agent orchestrator unit spec (stubs, no network) |
| `chromium` *(disabled)* | `tests/ui/**` (`@other-smoke`) | Marketing site `www.organuz.ai` (prod) |
| `product-setup` → `product-authenticated` *(disabled)* | `tests/product/support/auth.setup.ts` → `tests/product/flows/**` | Live per-role sanity e2e (skip-safe without creds) |

## Commands
- **Full local run + server stack + reports:** `./scripts/run-all-tests.sh [dev|test|prod]` (env is the optional **first arg**, default `dev`; also `npm run test:all` / `test:all:dev` / `test:all:prod`). It:
  1. selects the target env from the arg → exports `QA_TARGET_ENV` (authoritative over any inherited value) and loads `env/.<env>.env` (dev `dev1.app.organize.organuz.com` + password gate; prod `energy.organuz.com`, no gate);
  2. typechecks (`npx tsc --noEmit`);
  3. auto-starts the Docker stack (`api swagger prometheus grafana pushgateway`) if it isn't already healthy;
  4. runs every real project in one invocation so Allure aggregates the whole suite. It **intersects** the wanted set (`chromium organuz-api product agent security local-web` + `monitoring` when `MONITORING_ENABLED=true`) with the projects Playwright actually has configured (via `--list`), so a project commented out in `playwright.config.ts` is **skipped with a note** instead of aborting the run. **Currently** `organuz-api` + `agent` + `security` + `product` + `local-web` produce tests (110 total; `chromium` still disabled). Then generates the Allure 3 report;
  5. brings all servers up (adding `allure`) and **pushes this run's QA metrics to the Pushgateway** via `scripts/push-qa-metrics.mjs` (Prometheus scrapes it → Grafana);
  6. opens the servers (incl. the Grafana dashboard) and posts the Allure + Grafana links (with the env label) to Slack.
- **Server ports:** FastAPI `api` **8000**, Scalar/Swagger **8080**, Pushgateway **9091**, Prometheus **9092**, Grafana **3001**, Allure **5050**. Each host port is overridable via `API_PORT` / `SCALAR_PORT` / `PUSHGATEWAY_PORT` / `PROMETHEUS_PORT` / `GRAFANA_PORT` / `ALLURE_PORT` in the gitignored root `.env` (set the matching `*_URL` too) when another local compose stack already holds one.
- One project: `npx playwright test --project=organuz-api --reporter=list` (or `npm run test:ui` / `test:product`).
- Switch environment: pass it to the script (`./scripts/run-all-tests.sh prod`), or for a single ad-hoc run `QA_TARGET_ENV=prod npx playwright test --project=product`. Credentials/overrides live in `env/.<env>.env` (see the Environments & secrets section of CLAUDE.md).
- **Opt-in live monitoring:** `npm run test:monitoring` (`MONITORING_ENABLED=true`) registers the `monitoring` project — Govmap 25 + Ofek 25 = 50 live third-party availability checks (total suite 160). The default suite never runs these, so the green PR gate can't break on a Govmap/Ofek outage. `run-all-tests.sh` also adds `--project=monitoring` when `MONITORING_ENABLED=true`.
- Always `npx tsc --noEmit` before a run — the script does this first.

## Env / secrets
- Env credentials/overrides are split **per target env** under `env/` — `env/.dev.env` (default) and `env/.prod.env`, selected by `QA_TARGET_ENV`. `playwright.config.ts` loads `env/.<QA_TARGET_ENV>.env` first (wins), then a root `.env` as a fallback for shared vars not in the env file (dotenv never overrides). All are **gitignored** (Restricted); `env/README.md` / `.env.example` document the vars. Never commit them.
- The token-sanity / public-app-sanity dev checks need `PRODUCT_PLATFORM_PASSWORD` (dev password gate). Live per-role specs need per-role `<ROLE>_PHONE` / `<ROLE>_OTP_CODE` (CUSTOMER, CONSULTANT, COMPANY); these are **env-aware** — `tests/product/support/roleCredentials.ts` reads `<ENV>_<ROLE>_PHONE` (e.g. `DEV_CUSTOMER_PHONE`, `PROD_CUSTOMER_PHONE`) first, then falls back to the plain `<ROLE>_PHONE` (same for `_OTP_CODE`); absent → those roles skip. See the [organuz-product-roles] skill.
- The `product-setup` project (a dependency of `product-authenticated`) logs each role in once and saves `storageState`; per-role specs reuse it, so a full run does one OTP send per role. Sessions land in `playwright/.auth/` (gitignored); delete them to force a fresh login.
- Slack report links come from the gitignored `.env`: `SLACK_WEBHOOK_URL` and `SLACK_WEBHOOK_BOT_URL` (either/both; unset = skipped). Disable posting with `NOTIFY_SLACK=false`.

## Gotchas
- **Port 8000 conflict:** a leftover `ai_automation_testing` compose stack also binds 8000. If `run-all-tests.sh` fails with "port is already allocated", `docker stop ai_automation_testing-automation-server-1`.
- **QA metrics now go via the Pushgateway** (`scripts/push-qa-metrics.mjs` reads `test-results/results.json` → pushes `qa_playwright_*`). The `api` container no longer bind-mounts / reads `test-results`, so the old "stale bind-mount / restart api after tests" gotcha is gone. If Grafana test panels are empty, check the push step ran (Pushgateway ready at :9091, `results.json` present).
- Never use `waitForLoadState('networkidle')` in product tests (map iframe keeps the network busy).
