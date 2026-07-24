<div align="center">

# 🌞 OrGanuz AI Site Test Automation

***Playwright + TypeScript test automation for the OrGanuz marketing site & solar-calculator product — with a local FastAPI · Prometheus · Grafana QA dashboard.***

🎭 **Playwright**  ·  🟦 **TypeScript**  ·  🟢 **Node.js 22**  ·  🐳 **Docker**  ·  📈 **Grafana**  ·  🔥 **Prometheus**

✅ **188 default tests discovered**  ·  🛡️ **44 security + fraud checks**  ·  ♿ **30 WCAG / Axe checks**

| [🚀&nbsp;Setup](#local-setup) | [▶️&nbsp;Test&nbsp;Suite](#what-npm-test-runs) | [🛡️&nbsp;Security](#run-the-backend-security-pentest-tests) | [🤖&nbsp;QA&nbsp;Agent](#qa-agent) | [📊&nbsp;Dashboard](#grafana-qa-dashboard) | [⚙️&nbsp;CI](#github-actions) | [🔧&nbsp;Config](#configuration) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |

</div>

---

## ***What this is***

This repository holds the automated tests for two websites — the OrGanuz marketing site (`www.organuz.ai`) and the OrGanuz product application (the solar calculator) — plus a small set of local servers that turn the test results into a live QA dashboard.

The tests are written with [Playwright](https://playwright.dev/) (a browser-automation tool) in TypeScript. The supporting servers run in Docker and give you API documentation, metrics, and dashboards on your own machine.

> **New here? Jump to [Local Setup](#local-setup).** It has everything you need to install and run the tests.

---

## ***Stack***

Each part of the system and what it does:

- **Playwright** — runs the actual tests. The active default suite discovers **188 tests**: product calculator checks (`product`), the Organuz backend API contract (`organuz-api`), backend penetration tests (`security`), product fraud/ATO checks (`fraud`), local-only marketing e2e (`local-web`), QA-agent regressions (`agent`), and CI-enabled marketing accessibility checks (`accessibility`). The broader marketing UI checks (`chromium`) and live per-role product flows remain disabled. External-API monitoring is opt-in.
- **TypeScript** — the language the tests and framework code are written in.
- **FastAPI** — a small local web service that exposes health checks and metadata endpoints.
- **Scalar** — a nice API-reference page for the external OpenAPI docs.
- **Prometheus** — collects metrics.
- **Grafana** — displays those metrics as dashboards, including the ready-made *OrGanuz QA Dashboard*.
- **Allure and Playwright HTML reports** — human-readable test reports.
- **QA agent orchestrator** (`src/agent/`) — an automation program that ties together Azure DevOps, Playwright, OneDrive, and Google Sheets. It can also read requirements documents (PDF/DOCX/XLSX) to enrich test cases, and run the repo's Playwright projects through a real command-line runner. It includes a `TestPlanAgent` that generates a test plan from a URL by driving the Playwright MCP server.

---

## ***Project Structure***

```text
.
|-- Dockerfile
|-- docker-compose.yml
|-- playwright.config.ts
|-- scripts/
|   |-- run-all-tests.sh        # typecheck -> start stack -> run suite -> push QA metrics -> Slack links
|   |-- push-qa-metrics.mjs      # push qa_playwright_* metrics from results.json to the Pushgateway
|   `-- slack-alert-test.sh      # local smoke test that posts a marked TEST message to each webhook
|-- server/
|   |-- Dockerfile
|   |-- grafana/
|   |   `-- provisioning/
|   |-- prometheus.yml
|   |-- requirements.txt
|   |-- scalar/
|   `-- app/
|       `-- main.py
|-- docs/test-plans/          # written test plan per group + index, and pdf/ renders
|-- test-requirements-docs/   # sample requirements docs for the QA agent (generated)
|-- src/
|   |-- agent/                # QA agent orchestrator + TestPlanAgent (see src/agent/README.md)
|   |   |-- connectors/       # Azure DevOps, Google Sheets, OneDrive, Playwright, Playwright-MCP CLI client (+ stubs)
|   |   |-- utils/            # RequirementsReader (PDF/DOCX/XLSX parsing)
|   |   `-- demo/             # seed data, offline demo, generate-test-plan
|   |-- api/
|   |-- fixtures/
|   |-- pages/
|   |-- types/               # central types (agent, api, token, allure, organuz) + barrel
|   |-- tools/               # build-test-plan-pdfs
|   `-- utils/
`-- tests/
    |-- agent/
    |   `-- orchestrator/      # QA agent orchestrator specs
    |-- organuz-api/
    |   |-- contracts/         # Supabase/PostgREST projects schema + contract coverage
    |   |-- resources/         # projects query behaviours (select, order, filter, count)
    |   |-- security/          # anon auth, RLS, and negative cases
    |   `-- functions/         # edge-function CORS preflight checks
    |-- product/
    |   |-- matrix/            # product E2E matrix data + specs (credential-gated)
    |   |-- auth/              # signed-out cellular login dialog coverage
    |   |-- mobile/            # responsive phone-viewport checks + opt-in diagnostics
    |   |-- wizard/            # calculator wizard and customer-process e2e
    |   |-- flows/             # registration, full-flow, role specs (roles, areas, session, sanity, logout)
    |   |-- api/               # gated product role backend API checks
    |   |-- smoke/             # credential-free public calculator shell checks
    |   `-- support/           # page helpers, ProductFlows, fixtures, product-setup auth (storageState)
    |-- ui/                    # marketing-site specs (chromium project — currently disabled)
    |   |-- content/           # blog, FAQ, agents, projects, static pages
    |   |-- diagnostics/       # expected-failure pipeline checks
    |   |-- flows/             # cross-section critical user journeys
    |   |-- support/           # UI-only flow fixtures such as siteFlows
    |   `-- homepage/          # hero, navigation, contact
    |-- local-web/             # local-only marketing-site e2e (self-skips on CI)
    |-- accessibility/         # 30 CI-enabled WCAG/Axe marketing checks
    |-- fraud/                 # 14 non-destructive product fraud / ATO checks
    |-- security/              # authorized, safe-by-default backend pentest specs
    |   `-- support/           # anon-key target helper
    |-- monitoring/            # live Govmap + Ofek availability checks (opt-in)
    |   `-- support/           # availability canary + endpoints helper
    `-- constants.ts
```

---

## ***Local Setup***

You need **Node.js 22**. (The CI workflows pin `node-version: 22`; Node 20 is no longer supported for this repo.)

Install dependencies:

```bash
npm ci
```

Run all tests with the default settings:

```bash
npm test
```

### ***What `npm test` runs***

`npm test` runs the Playwright projects that are currently **active** in `playwright.config.ts`: `product`, `organuz-api`, `agent`, `security`, `fraud`, `local-web`, and `accessibility`.

The default suite currently discovers **188 tests**:

- `product` discovers 61 tests — public API sanity (8), cellular-login UI (9), English sanity (6), offline matrix/role contracts (23), mobile coverage (7, including one opt-in diagnostic probe), and wizard/customer-process coverage (8). Live role specs under `flows/**` remain excluded.
- `organuz-api` runs one `@other-smoke` API contract.
- `agent` runs two `@other-smoke` tests (the orchestrator regression and the URL-driven test-plan generator).
- `security` runs 30 authorized, safe-by-default backend penetration checks (`SEC-01…SEC-30`, including the `SEC-21…SEC-30` account-takeover set); two mutating denial probes skip unless a disposable target is explicitly acknowledged.
- `fraud` runs 14 authorized, non-destructive product-app fraud and account-takeover checks.
- `local-web` runs 50 local-only marketing-site e2e — but every spec **self-skips when `CI` is set**, so they run only on a developer machine.
- `accessibility` runs 30 WCAG/Axe and semantic regression checks against the public marketing homepage in local and CI runs.

The marketing-site (`chromium`) and the live per-role product projects (`product-setup`, `product-authenticated`) remain **disabled** — commented out in `playwright.config.ts`. Their spec files under `tests/ui/**` and `tests/product/flows/**` are kept; re-enable a project by uncommenting its block. When enabled the counts are: `chromium` 12, `product-setup` 3, `product-authenticated` 10 (the 13 product-* live specs are credential-gated per-role tests that *skip* without persona secrets).

The opt-in `monitoring` project is never part of this default gate. Enabling it (`MONITORING_ENABLED=true`, see [External API monitoring](#external-api-monitoring-govmap--ofek)) adds 50 more tests, for **238 discovered tests**.

A couple more defaults worth knowing:

- Live per-role browser flows stay gated (they don't run) unless the `product-setup` / `product-authenticated` projects are re-enabled **and** persona credentials are set.

### ***Run the full local automation flow***

```bash
./scripts/run-all-tests.sh
```

This one script does everything end to end. In order, it:

1. Typechecks the project.
2. Starts the local server stack when needed.
3. Runs the active Playwright projects in a single invocation — currently `product`, `organuz-api`, `agent`, `security`, `fraud`, `local-web`, and `accessibility` (the `chromium`, `product-setup`, and `product-authenticated` projects run too once they are re-enabled in `playwright.config.ts`). Results go into a freshly cleaned `allure-results/`, so the report aggregates all of them.
4. Generates an Allure 3 report.
5. Brings up all local servers (FastAPI, Scalar, Prometheus, Pushgateway, Grafana, Allure).
6. Pushes the run's QA metrics to the Pushgateway, so Grafana shows fresh numbers.
7. Opens the Grafana dashboard.
8. Posts the run status + Allure / Grafana / Playwright HTML / Scalar report links to every configured Slack webhook (`SLACK_WEBHOOK_URL` / `SLACK_WEBHOOK_BOT_URL` / `SLACK_ORGANUZ_TESTING_URL`, the #organuz-testing channel). Each message is labeled by its source — *Local* vs *GitHub Actions*.
9. Prints the main service URLs at the end.

The credential-gated role flows (`product-setup` → `product-authenticated`) stay out of this run. Run them directly instead:

```bash
npx playwright test --project=product-authenticated
```

To smoke-test the Slack webhooks without doing a full run, use `./scripts/slack-alert-test.sh`. It posts a clearly-marked TEST message to each webhook and never prints the URLs.

### ***Run only UI tests***

```bash
npm run test:ui
```

`npm run test:ui` runs the active marketing-site UI suite — the `local-web` project (`tests/local-web/**`, see below).

> The original `chromium` project (`tests/ui/**`) is **currently disabled** in `playwright.config.ts` (its spec files are kept; re-enable by uncommenting the `chromium` block). Because `chromium` isn't registered, `test:ui` points at `local-web` so the command works today. Note `local-web` **self-skips when `process.env.CI` is set**, so on CI this command runs no tests.

### ***Run the local-web marketing e2e (local only)***

```bash
npx playwright test --project=local-web
```

The `local-web` project (`tests/local-web/**`, 50 tests) drives a real chromium context against the prod marketing site `https://www.organuz.ai` — hero/nav, audiences, contact, FAQ, and agents/projects coverage. It is registered by default and runs locally, but **every spec self-skips when `process.env.CI` is set** (via `localOnly()` in `tests/local-web/support.ts`), and the CI matrix does not list the project — an intentional local/CI divergence (a sanctioned skip, per the `test-suite-parity` skill).

### ***Run the product project (61 discovered tests)***

```bash
npm run test:product
```

The `product` project is **active** and targets the calculator app for the selected `QA_TARGET_ENV` (default dev). It currently discovers 61 tests across public API sanity, English UI sanity, cellular login, responsive mobile layouts, calculator wizard/customer-process journeys, and offline matrix/role contracts. The live per-role browser flows live in the disabled `product-setup` / `product-authenticated` projects (re-enable both together to run them).

The product suite is split into two Playwright projects: the plain `product` project and the role-session `product-authenticated` project.

The matrix is **data-driven** — it's generated from `tests/product/matrix/e2e-matrix.data.ts` rather than being hand-written test by test. It covers:

- 12 main `CALC-ROOF-*` characterization scenarios from the working document.
- 4 personas per main scenario: customer, consultant, company, and company employee.
- Property types: private house, residential building, commercial, agricultural, and public.
- Polygon behavior: building, parking, sports court, and mixed building + parking/sports-court flows.
- Roof/surface types: concrete, tiles, iscoverit, parking, and sports court.
- Negative coverage for fewer than 5 panels.
- UI-only tracking for the no-panel case, where the request should *not* be sent.

`npm run test:product` runs the whole 61-test `product` project. The matrix contract asserts the generated combinations offline — the 48 main scenario/persona combinations, one insufficient-panels negative case, and one company-employee access-blocking case — without opening a browser. Live wizard steps that drive Govmap geocoding self-skip on CI; the real OTP-send check requires `PRODUCT_OTP_UI=true`; authenticated characterization requires `PRODUCT_WIZARD_E2E=true`; and the temporary mobile navigation probe requires `MOBILE_NAV_EXPLORE=true`.

### ***External API monitoring (Govmap + Ofek)***

The product depends on two outside map services. This group checks that they're up and behaving:

- **Govmap** (`www.govmap.gov.il`) — the map API and address geocoding.
- **Ofek** (`basemaps.govmap.gov.il`) — the Survey-of-Israel national orthophoto (aerial) tiles the roof scan runs on.

There are 25 checks each (50 total). They use `APIRequestContext` only — no browser.

```bash
npm run test:monitoring
```

Two things make this group different from the rest:

- **It's opt-in locally.** The project is registered only when `MONITORING_ENABLED=true`, so it never runs in the default suite.
- **It's *meant* to fail when a dependency is down.** A failure here is the alert, not a bug in our code. The one exception: when the Govmap edge serves this runner an HTML block/challenge page (an HTTP 200 geo/bot block, common from CI IPs outside Israel) the checks **skip** rather than fail — that's an environmental block, not a real outage. A real-but-wrong payload still fails as the alert. The detection lives in `tests/monitoring/support/availability.ts` (a `beforeEach` canary).

On GitHub Actions it runs two ways:

1. A **scheduled workflow** (`.github/workflows/monitoring.yml`) every 30 minutes, with GitHub-issue + Slack alerting.
2. A **non-blocking `monitoring` job** inside the main `parallel-tests.yml` pipeline, on every push/PR. It's marked `continue-on-error: true`, so a Govmap/Ofek outage shows the job as red and folds into the Allure report but **never fails the code pipeline / green PR gate**.

When it fails, the scheduled workflow:

- Opens a single auto-managed `monitoring-alert` GitHub issue (and auto-closes it on the next green run).
- Posts a Slack alert to every configured webhook — `SLACK_WEBHOOK_URL` and/or `SLACK_WEBHOOK_BOT_URL` (repository secrets in CI, gitignored `.env` locally).

The `force_fail` `workflow_dispatch` input lets you exercise the alert path on demand. Endpoints, tokens, and tile coordinates live in `config.json → monitoring`.

### ***More about the `product` project***

Beyond the matrix, the `product` project also carries credential-free smoke specs and registration coverage, so it has real runnable coverage even without persona credentials:

- **Smoke checks** exercise the public calculator shell served before login — the Organuz title, arena entry points, register/login entry, the four-step characterization stepper, the address step, and the disabled "continue" state.
- **Registration specs** cover property-owner form validation, required terms consent, invalid-mobile gating, optional-consent behavior, full property-owner signup, and company/consultant lead-form redirects.

### ***Run the live persona browser flows***

The live per-role browser flows live in the `product-setup` and `product-authenticated` projects, which are **currently disabled** (commented out in `playwright.config.ts`; specs under `tests/product/flows/**` are kept). Re-enable both blocks together, then run:

```bash
npx playwright test --project=product-authenticated
```

They need per-role phone/OTP credentials. Credentials are **env-aware**: for the active `QA_TARGET_ENV` the runner reads `<ENV>_<ROLE>_PHONE` first (e.g. `DEV_CUSTOMER_PHONE`, `PROD_CUSTOMER_PHONE`) and falls back to the plain `<ROLE>_PHONE`, resolved in `tests/product/support/roleCredentials.ts` (the OTP follows the same rule; dev uses the fixed OTP `7777`). Set them for `CUSTOMER`, `CONSULTANT`, `COMPANY` in the gitignored per-env file (see [Environment files](#environment-files)). A role with no credential is skipped, so the projects stay green without secrets.

**How the sessions are shared:** only the `product-authenticated` project depends on `product-setup` (`tests/product/support/auth.setup.ts`). Setup logs each authenticated role — `customer`, `consultant`, `company` — in once and saves its `storageState` (the saved browser session) to `playwright/.auth/` (gitignored). The per-role specs then resume that saved session via `test.use({ authRole })` + `product.resumeSession()` instead of logging in again — so those specs send at most one OTP per role. Smoke, registration, and the offline matrix/role contracts stay in the plain `product` project so they don't trigger the shared auth setup unnecessarily.

By default, broad lower-priority marketing suites tagged `@low-priority` are excluded. Set `INCLUDE_LOW_PRIORITY_TESTS=true` to include them.

### ***Run the backend security (pentest) tests***

```bash
npx playwright test --project=security
```

The `security` project (`tests/security/**`, 30 checks) is **authorized, safe-by-default penetration testing** of the Organuz Supabase/PostgREST backend using only the public `anon` key (browserless `APIRequestContext`). The checks `SEC-01…SEC-30` span authentication, RLS write-blocking, table enumeration and data exposure, injection/XSS handling, error hygiene, HTTPS, CORS, JWT hygiene, edge-function auth, and **account takeover** (`SEC-21…SEC-30`: forged-credential login, forged/replayed refresh token, forged & `alg:none`/tampered JWTs, wrong-OTP no-session, no account enumeration, bad-login-burst resistance, admin user-provisioning blocked, auth error hygiene). `SEC-06` and `SEC-08` can mutate data when the policy under test is broken, so they skip by default. Run them only against a disposable backend by setting `SECURITY_WRITE_PROBES=true` and `SECURITY_WRITE_TARGET` to the exact backend origin. The remaining probes run normally in CI.

### ***Run the Organuz backend API tests***

```bash
npx playwright test --project=organuz-api
```

The `organuz-api` project targets the Organuz Supabase/PostgREST backend (`config.json → organuzApi`). It exercises the `/rest/v1/projects` REST resource — its contracts, query behaviours, and anon-key auth/RLS (row-level security) — plus the edge-function CORS preflights. It uses the public `anon` key that's already baked into the site bundle. These tests are read-only; they never POST to the edge functions.

### ***Run the agent regression tests***

```bash
npx playwright test --project=agent
```

### ***Type checking and linting***

```bash
npm run typecheck
```

```bash
npm run lint
```

Linting uses ESLint's flat config (`eslint.config.mjs`) with the `typescript-eslint` recommended ruleset over `src/` and `tests/`.

---

## ***QA Agent***

The repository includes a QA agent orchestrator under `src/agent/`. It coordinates four systems:

- **Azure DevOps** — the system of record.
- **Playwright** — execution.
- **OneDrive** — the evidence store.
- **Google Sheets** — test data and the results log.

It runs the suite end-to-end: read cases, optionally enrich acceptance criteria from requirements docs, pull data, execute, push evidence, write results back, file bugs idempotently (without creating duplicates), re-run flaky failures once, and emit a summary.

Run the offline demo (everything wired to in-memory stubs, no credentials needed):

```bash
npm run agent:demo
```

Run the repository's real Playwright projects through the agent (Azure DevOps / Sheets / OneDrive are stubbed; Playwright is real):

```bash
npm run agent:current-tests
```

Generate a test plan from a URL. The `TestPlanAgent` explores a page and produces a `TestSuite` (page-load, headings, per-link, and form cases) in the same shape the orchestrator consumes. It's offline by default; `--live` drives the real **Playwright MCP CLI server** (`npx @playwright/mcp`) to explore a live browser:

```bash
npm run agent:plan -- https://www.organuz.ai          # offline stub
npm run agent:plan -- https://www.organuz.ai --live   # real browser via Playwright MCP
```

Written test plans for every test group live in [`docs/test-plans/`](docs/test-plans/) (one per group, plus an index). Render them to PDF (`docs/test-plans/pdf/`) with:

```bash
npm run test-plans:pdf
```

`agent:current-tests` generates one orchestrator case per current Playwright project:

| Case | Command |
| --- | --- |
| `PW-ORGANUZ-API` | `npx playwright test --project=organuz-api` |
| `PW-CHROMIUM` | `npx playwright test --project=chromium` |
| `PW-PRODUCT` | `npx playwright test --project=product --grep "Product calculator and quotation E2E matrix"` |
| `PW-AGENT` | `npx playwright test --project=agent` |

The command exits non-zero if any mapped project fails or is blocked.

Generate a sample set of requirements documents and run with enrichment enabled:

```bash
npm run agent:build && node dist/src/agent/demo/generate-test-files.js
QA_REQUIREMENTS_PATH=test-requirements-docs npm run agent:demo
```

The agent has its own Playwright project (`agent`, matching `tests/agent/**/*.spec.ts`) for orchestrator regression coverage:

```bash
npx playwright test --project=agent
```

Configuration is env-driven via `ADO_*` and `QA_*` variables (see `.env.example`). Full design notes, the connector interfaces, and the path from stubs to real backends are documented in [`src/agent/README.md`](src/agent/README.md).

---

## ***Docker Compose***

Start the FastAPI server:

```bash
docker compose up --build api
```

Start the runtime service stack:

```bash
docker compose up --build api swagger prometheus grafana allure
```

Run all tests in Docker:

```bash
docker compose run --rm tests
```

Start only the local report server after an Allure report already exists:

```bash
docker compose up -d allure
```

---

## ***Service URLs***

| Service | URL |
| --- | --- |
| FastAPI root | `http://localhost:8000/` |
| FastAPI health | `http://localhost:8000/health` |
| Automation overview | `http://localhost:8000/automation` |
| Playwright project metadata | `http://localhost:8000/automation/playwright-projects` |
| QA agent command metadata | `http://localhost:8000/automation/qa-agent` |
| FastAPI metrics | `http://localhost:8000/metrics` |
| FastAPI built-in Swagger | `http://localhost:8000/docs` |
| External Scalar API reference | `http://localhost:8080` |
| Prometheus | `http://localhost:9092` |
| Pushgateway (QA metrics) | `http://localhost:9091` |
| Grafana | `http://localhost:3001` |
| Grafana QA dashboard | `http://localhost:3001/d/organuz-qa-dashboard/organuz-qa-dashboard` |
| Allure report server | `http://localhost:5050` |

Grafana is mapped to host port `3001` because port `3000` is commonly used by local frontend dev servers. Inside Docker Compose, Grafana still listens on `grafana:3000`.

---

## ***Grafana QA Dashboard***

The provisioned QA dashboard reads Prometheus metrics that the test runner **pushes** to the Prometheus Pushgateway. `scripts/push-qa-metrics.mjs` parses the latest Playwright JSON report at `test-results/results.json` and pushes:

| Metric | Query example |
| --- | --- |
| Test totals by project/status | `sum by(project, status)(qa_playwright_tests_total)` |
| Failed tests | `sum(qa_playwright_tests_total{status="failed"})` |
| Pass rate by project | `100 * sum by(project)(qa_playwright_tests_total{status="passed"}) / sum by(project)(qa_playwright_tests_total)` |
| Run duration by project | `qa_playwright_duration_seconds` |
| Report age | `time() - qa_playwright_last_run_timestamp_seconds` |
| Report loaded flag | `qa_playwright_report_present` |

`scripts/run-all-tests.sh` pushes these after each run (Prometheus then scrapes the Pushgateway with `honor_labels: true`). To refresh the numbers by hand after a run:

```bash
PUSHGATEWAY_URL=http://localhost:9091 node scripts/push-qa-metrics.mjs
```

The FastAPI `/metrics` endpoint still provides the `process_*` / `up` metrics the system dashboard uses, but it no longer reads the results file — which is what removed the old stale-bind-mount refresh hack.

Open the dashboard locally after the stack is running:

```bash
docker compose up -d --build api prometheus grafana
```

Then browse to `http://localhost:3001/d/organuz-qa-dashboard/organuz-qa-dashboard`.

### ***Hosting Grafana externally (clickable dashboard links)***

GitHub Pages **cannot** host Grafana. Pages is static hosting, and Grafana is a live server that queries Prometheus as its backend. To get an interactive dashboard with browser-clickable links (in Slack alerts and the CI report summary), host Grafana somewhere that has a backend, and point the links at it. The repo is already wired for this — you only supply the host.

**Recommended: Grafana Cloud (free tier, fully managed).**

1. Create a free Grafana Cloud stack. From its Prometheus data source, note the **remote_write URL** and **instance ID** (username), and create a **MetricsPublisher** API token.
2. Save the token to the gitignored file `server/grafana-cloud-token` (one line, no trailing newline). It's mounted into the `prometheus` container and never committed.
3. In `server/prometheus.yml`, uncomment the `remote_write:` block and set the `url` + `username`. In `docker-compose.yml`, uncomment the `grafana-cloud-token` volume on the `prometheus` service. Restart: `docker compose up -d --force-recreate prometheus`. Your local Prometheus now ships all metrics (including `qa_playwright_*`) up to Grafana Cloud.
4. In Grafana Cloud, import the dashboards from `server/grafana/provisioning/dashboards/*.json` (keep the same UIDs, e.g. `organuz-system-tests`, so the dashboard URL path matches).
5. Point the links at it:
   - **Local:** set `GRAFANA_URL=https://<your-stack>.grafana.net` in your gitignored `.env`. `run-all-tests.sh` derives `GRAFANA_DASHBOARD_URL` from it, so the Slack "Local test run" message links to the hosted dashboard.
   - **CI:** set the `GRAFANA_URL` repository **variable** (Settings → Secrets and variables → Actions → Variables). The report summary + Slack notification link to it automatically.

**Self-host instead (Fly.io, a small VM, etc.):** run this same `docker-compose.yml` stack on the host, expose Grafana over HTTPS, and set `GRAFANA_URL` to that origin. No `remote_write` needed, since Prometheus and Grafana live together.

---

## ***Reports***

Docker test runs write reports back to the host through bind mounts:

- `test-results/`
- `playwright-report/`
- `allure-results/`
- `allure-report/`
- `blob-report/`

Open the Playwright HTML report:

```bash
npm run report
```

Generate the Allure report in CI mode:

```bash
npm run report:allure:ci
```

The CLI runner also generates an Allure 3 report after Playwright finishes, and starts the local Allure static server:

```bash
./scripts/run-all-tests.sh
```

At the end of the run it prints:

```text
FastAPI:  http://localhost:8000
Scalar:   http://localhost:8080
Grafana:  http://localhost:3001
Allure:   http://localhost:5050
```

The script preserves the Playwright exit code. Even when tests fail, it still tries to generate and serve the Allure report before exiting.

The UI suite includes `tests/ui/diagnostics/intentionally-failing.spec.ts`, an expected-failure test tagged `@intentionally-failing`. It validates the failure-capture pipeline without turning CI red. To skip it locally:

```bash
npx playwright test --grep-invert "@intentionally-failing"
```

Failure artifacts are collected by `src/fixtures/index.ts` and attached to Allure whenever Playwright records screenshots, videos, traces, or other attachments.

---

## ***Configuration***

Runtime configuration is read from environment variables, with fallbacks in `config.json`.

| Variable | Purpose |
| --- | --- |
| `WEB_BASE_URL` | Base URL for UI tests |
| `QA_TARGET_ENV` | Product target environment (`dev` \| `test` \| `prod`, default `dev`), resolved from `config.json → environments` |
| `APP_BASE_URL` / `APP_ADMIN_URL` | Explicit overrides for the product app / admin URLs |
| `ORGANUZ_API_ANON_KEY` | Overrides the public Supabase anon key used by the `organuz-api` tests |
| `DEFAULT_TIMEOUT` | Playwright default timeout |
| `NAVIGATION_TIMEOUT` | Navigation timeout |
| `WORKERS` | Playwright worker count |
| `BROWSER` | Browser project selection |
| `INCLUDE_LOW_PRIORITY_TESTS` | Include broad marketing suites tagged `@low-priority` |
| `PRODUCT_OTP_UI` | Enables the one cellular-login check that sends a real dev OTP (`true`); disabled by default |
| `PRODUCT_WIZARD_E2E` | Enables authenticated wizard characterization that creates a real dev project (`true`); disabled by default |
| `MOBILE_NAV_EXPLORE` | Enables the temporary mobile-navigation diagnostic probe (`true`); disabled by default |
| `FRAUD_AUTH_BACKEND` / `FRAUD_APP_TOKEN` / `FRAUD_OTP_VERIFY_CALL` | Optional fraud-suite endpoint/token/OTP-method overrides |
| `MONITORING_ENABLED` | Registers the opt-in `monitoring` project (`true` to run the live Govmap/Ofek checks) |
| `QA_PLAYWRIGHT_RESULTS_PATH` | Path read by `scripts/push-qa-metrics.mjs` for the latest Playwright JSON report; defaults to `test-results/results.json` |
| `PUSHGATEWAY_URL` | Prometheus Pushgateway the QA metrics are pushed to; defaults to `http://localhost:9091` |

The Playwright projects `product`, `organuz-api`, `agent`, `security`, `fraud`, `local-web`, and `accessibility` are active by default; `chromium`, `product-setup`, and `product-authenticated` are commented out in `playwright.config.ts` with their specs retained; `monitoring` is opt-in:

| Project | Status | Test files | Target | Typical command |
| --- | --- | --- | --- | --- |
| `product` | active | `tests/product/**/*.spec.ts` excluding `flows/**` (61 discovered) | Product calculator: public/API, cellular login, English, matrix, mobile, and wizard coverage | `npx playwright test --project=product` |
| `organuz-api` | active | `tests/organuz-api/**/*.spec.ts` filtered to `@other-smoke` (1) | Organuz Supabase/PostgREST backend (`/rest/v1/projects`, edge functions) | `npx playwright test --project=organuz-api` |
| `agent` | active | `tests/agent/**/*.spec.ts` filtered to `@other-smoke` (2) | QA-agent orchestrator + TestPlanAgent stubs (no network) | `npx playwright test --project=agent` |
| `security` | active | `tests/security/**/*.spec.ts` (30) | Authorized, safe-by-default pentest of the Organuz Supabase backend (anon key), incl. account-takeover checks | `npx playwright test --project=security` |
| `fraud` | active | `tests/fraud/**/*.spec.ts` (14) | Authorized, non-destructive fraud/ATO checks for the product app and auth backend | `npx playwright test --project=fraud` |
| `local-web` | active, but every spec self-skips on CI | `tests/local-web/**/*.spec.ts` (50) | Local-only marketing-site e2e vs prod `https://www.organuz.ai` | `npx playwright test --project=local-web` |
| `accessibility` | active | `tests/accessibility/**/*.spec.ts` (30) | WCAG/Axe + semantic regressions for the public marketing homepage | `npx playwright test --project=accessibility` |
| `chromium` | disabled (commented out; specs kept) | `tests/ui/**/*.spec.ts` filtered to `@other-smoke` (12) | Marketing site `https://www.organuz.ai` (prod) | `npx playwright test --project=chromium` |
| `product-setup` | disabled (commented out; specs kept) | `tests/product/support/auth.setup.ts` (3) | Logs each product role in once and saves its `storageState` | runs automatically as a `product-authenticated` dependency |
| `product-authenticated` | disabled (commented out; specs kept) | `tests/product/flows/**/*.spec.ts` (10) | Authenticated customer / consultant / company role coverage | `npx playwright test --project=product-authenticated` |
| `monitoring` | opt-in (`MONITORING_ENABLED=true`) | `tests/monitoring/**/*.spec.ts` (50) | Live Govmap + Ofek external-dependency availability | `npm run test:monitoring` |

Re-enable a disabled project by uncommenting its block in `playwright.config.ts`.

The default suite discovers **188 tests** (`product` 61 + `organuz-api` 1 + `agent` 2 + `security` 30 + `fraud` 14 + `local-web` 50 + `accessibility` 30), or **238** with `MONITORING_ENABLED=true`. The 50 `local-web` tests run only off CI, so the main CI matrix discovers 138 tests plus the separate non-blocking 50-test monitoring job. Environment- and opt-in-gated cases may report as skipped.

### ***Environment files***

Env credentials and local overrides are **split per target environment** under `env/`, selected by `QA_TARGET_ENV`:

| `QA_TARGET_ENV` | File loaded | Product target | Password gate |
| --- | --- | --- | --- |
| `dev` (default) | `env/.dev.env` | `dev1.app.organize.organuz.com` | yes |
| `prod` | `env/.prod.env` | `energy.organuz.com` | no |

`playwright.config.ts` loads `env/.${QA_TARGET_ENV}.env` first (it wins); an optional root `.env` is a shared fallback (dotenv never overrides). Per-role login uses `<ROLE>_PHONE` / `<ROLE>_OTP_CODE` for `CUSTOMER`, `CONSULTANT`, `COMPANY`, resolved env-aware in `tests/product/support/roleCredentials.ts` (which also accepts a legacy `<ENV>_<ROLE>_PHONE` form, e.g. `DEV_CUSTOMER_PHONE`); dev uses the fixed OTP `7777`.

The real `env/.dev.env` / `env/.prod.env` are **gitignored** (Restricted); only the `*.example` templates are committed. Copy a template to start: `cp env/.dev.env.example env/.dev.env`. On CI the prod pipeline materializes `env/.prod.env` from the `DOTENV_PROD` repo secret. See `env/README.md`. **Never commit real env files or move secrets into tracked files.**

The QA agent reads its own variables (`ADO_PLAN_ID`, `ADO_SUITE_ID`, `ADO_START_READONLY`, `QA_ENVIRONMENT`, `QA_RERUN_FLAKY`, `QA_FLAKY_TAG`, `QA_FILE_BUGS`, `QA_MAX_CASES`, `QA_EVIDENCE_PREFIX`, `QA_REQUIREMENTS_PATH`, `QA_REQUIREMENTS_SOURCE`). They're listed with defaults and purpose in [`src/agent/README.md`](src/agent/README.md) and seeded in `.env.example`. `agent:current-tests` also respects the normal Playwright target variables such as `WEB_BASE_URL`, `QA_TARGET_ENV`, and `APP_BASE_URL`.

Local service URL variables used by `scripts/run-all-tests.sh`:

| Variable | Default |
| --- | --- |
| `FASTAPI_URL` | `http://localhost:8000` |
| `SWAGGER_URL` | `http://localhost:8080` |
| `PROMETHEUS_URL` | `http://localhost:9092` |
| `GRAFANA_URL` | `http://localhost:3001` |
| `ALLURE_URL` | `http://localhost:5050` |
| `AUTO_START_API` | `true` |

---

## ***GitHub Actions***

The parallel pipeline in `.github/workflows/parallel-tests.yml` runs:

- `typecheck`
- The Playwright `organuz-api`, `agent`, `security`, `fraud`, `product`, and `accessibility` projects in parallel (a matrix).
- A non-blocking `monitoring` job (live Govmap + Ofek checks) — `continue-on-error: true`, so an outage shows the job red and folds into the Allure report but never fails the green PR gate.
- The FastAPI, Scalar API reference, Prometheus, and Grafana service smoke checks.
- Allure 3 report generation.
- GitHub Pages deployment for the Allure report on `main` or `master`.
- GitHub Actions summary links for Allure, FastAPI, Scalar, and Grafana.

> **Parity note:** the workflow's `strategy.matrix.project` is `organuz-api, agent, security, fraud, product, accessibility`; the `chromium` and `product-authenticated` shards stay disabled. The `local-web` project is deliberately **not** in the matrix because it self-skips on CI.

The workflow summary includes:

| Link | Source |
| --- | --- |
| Allure 3 report | GitHub Pages deploy output, or the repository Pages URL fallback |
| FastAPI server | `FASTAPI_URL` repository variable, or `http://localhost:8000` fallback |
| Scalar API reference | `SWAGGER_URL` repository variable, or `http://localhost:8080` fallback |
| Grafana dashboard | `GRAFANA_URL` repository variable, or `http://localhost:3001` fallback |

Set these repository variables when the summary should point to externally reachable services:

- `FASTAPI_URL`
- `SWAGGER_URL`
- `GRAFANA_URL`

---

## ***CLI***

```bash
./scripts/run-all-tests.sh
```

---

## ***Architecture***

Open [Architecture.html](Architecture.html) in a browser for a pastel, single-file visual overview of the Docker Compose services, the CLI flow, the GitHub Actions pipeline, report publishing, the QA agent orchestrator, the product matrix, the QA dashboard, and the project structure.

The test suite is organized by subject under `tests/`: UI homepage/content, accessibility, Organuz backend API contracts, product API/auth/English/matrix/mobile/wizard/role coverage, agent coverage, backend penetration testing, product fraud/ATO, local-only marketing e2e, and live external-dependency monitoring.

For the QA agent specifically — its architecture diagram, the orchestration loop, the design decisions it encodes, and how to swap stubs for real connectors — see [`src/agent/README.md`](src/agent/README.md).
