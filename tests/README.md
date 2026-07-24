# Test Layout

Tests are grouped by subject so each Playwright project stays easy to scan.

| Area | Folder | Purpose |
| --- | --- | --- |
| UI homepage | `tests/ui/homepage/` | Hero, navigation, contact, and homepage shell checks (`chromium` project — currently disabled). |
| UI content | `tests/ui/content/` | Blog, FAQ, agents, projects, and static page coverage (disabled). |
| Local web | `tests/local-web/` | Local-only marketing-site e2e vs prod `www.organuz.ai`; every spec self-skips on CI (`local-web` project). |
| Security | `tests/security/` | Authorized, safe-by-default backend penetration tests (`SEC-01…SEC-30`, incl. account takeover; `security` project). |
| Fraud / ATO | `tests/fraud/` | Fourteen authorized, non-destructive product-app fraud and account-takeover checks. |
| Accessibility | `tests/accessibility/` | Thirty CI-enabled WCAG/Axe and semantic regression checks for the marketing homepage. |
| Organuz API contracts | `tests/organuz-api/contracts/` | Supabase/PostgREST `projects` schema and response contract coverage. |
| Product API | `tests/product/api/` | Public product token sanity + public-app-sanity checks. |
| Product auth | `tests/product/auth/` | Signed-out cellular login dialog and opt-in OTP-step coverage. |
| Product English | `tests/product/en/` | Public English-language calculator sanity checks. |
| Product matrix | `tests/product/matrix/` | Offline persona/role data-contract specs over checked-in matrix fixtures. |
| Product mobile | `tests/product/mobile/` | Pixel/Galaxy responsive shell, overflow, and login-dialog checks. |
| Product wizard | `tests/product/wizard/` | Calculator wizard and customer-process browser journeys. |
| Product flows | `tests/product/flows/` | Live per-role browser specs (`product-authenticated` project — currently disabled). |
| Product support | `tests/product/support/` | Product app page helpers, `ProductFlows`, fixtures, and the `product-setup` auth (`auth.setup.ts` + `auth.ts` save each role's `storageState` for reuse). |
| UI support | `tests/ui/support/` | UI-only fixture extensions, including `siteFlows`, layered on top of the shared `src/fixtures`. |
| Agent orchestrator | `tests/agent/orchestrator/` | QA agent orchestration regression specs. |
| Agent test-plan | `tests/agent/test-plan/` | `TestPlanAgent` spec — URL → Playwright-MCP exploration → generated `TestSuite`. |
| External monitoring | `tests/monitoring/` | Live Govmap + Ofek third-party availability checks (opt-in `monitoring` project, `MONITORING_ENABLED=true`). |

Each Playwright project (a named group of tests in the config) picks up its files
with a recursive glob (a folder-matching pattern that also reaches into
sub-folders). `product`, `organuz-api`, `agent`, `security`, `fraud`, `local-web`, and `accessibility` are
**active** by default today; the `chromium`, `product-setup`, and `product-authenticated`
projects are **currently disabled** — commented out in `playwright.config.ts`, with their
spec files retained. Re-enable one by uncommenting its block. The projects and their globs
are:

- `product` *(active, 60 discovered tests)*: `tests/product/**/*.spec.ts` excluding `flows/**` — API/public sanity (8), cellular login (9), English sanity (6), matrix/role contracts (23), mobile (6), and wizard/customer-process coverage (8). Targets the calculator app for the selected `QA_TARGET_ENV` (default dev).
- `organuz-api` *(active, 1 test)*: `tests/organuz-api/**/*.spec.ts`, default-filtered to `@other-smoke`
- `agent` *(active, 2 tests)*: `tests/agent/**/*.spec.ts`, default-filtered to `@other-smoke`
- `security` *(active, 30 tests)*: `tests/security/**/*.spec.ts` — authorized, safe-by-default penetration testing of the Organuz Supabase backend with the public anon key, incl. the `SEC-21…SEC-30` account-takeover checks. The INSERT and unqualified DELETE denial probes skip unless a disposable target is explicitly acknowledged with `SECURITY_WRITE_PROBES=true` and an exact `SECURITY_WRITE_TARGET`.
- `fraud` *(active, 14 tests)*: `tests/fraud/**/*.spec.ts` — non-destructive fraud/ATO checks for the product origin and auth backend. Runs in the dev CI matrix.
- `local-web` *(active, 50 tests, but self-skips on CI)*: `tests/local-web/**/*.spec.ts` — local-only marketing-site e2e (real chromium vs prod `www.organuz.ai`). Every spec calls `localOnly()` (`tests/local-web/support.ts`), which `test.skip`s the file when `process.env.CI` is set, and the CI matrix does not list the project — an intentional local/CI divergence (a sanctioned skip).
- `accessibility` *(active, 30 tests)*: `tests/accessibility/**/*.spec.ts` — CI-enabled Axe/WCAG baselines plus strict language, direction, heading, image, link, focus-order, form, and ARIA semantics checks against `www.organuz.ai`.
- `chromium` *(disabled — commented out; specs kept, 12 tests when enabled)*: `tests/ui/**/*.spec.ts`, default-filtered to `@other-smoke`
- `product-setup` *(disabled — commented out; specs kept, 3 tests when enabled)*: `tests/product/support/auth.setup.ts`
- `product-authenticated` *(disabled — commented out; specs kept, 10 tests when enabled)*: `tests/product/flows/**/*.spec.ts` — per-role specs that resume saved sessions (depends on `product-setup`)
- `monitoring` *(opt-in, 50 tests)*: `tests/monitoring/**/*.spec.ts` — live Govmap + Ofek availability
  checks; registered only when `MONITORING_ENABLED=true`, so it is never in the default suite
  (it runs on a schedule via `.github/workflows/monitoring.yml`, plus a non-blocking job in
  `parallel-tests.yml`). It **skips** (not fails) when the runner is served an HTML
  block/challenge page — a geo/bot block rather than a real outage — via the `beforeEach`
  canary in `tests/monitoring/support/availability.ts`.

The default suite therefore discovers **187 tests** (`product` 60 + `organuz-api` 1 + `agent` 2 +
`security` 30 + `fraud` 14 + `local-web` 50 + `accessibility` 30), or **237** with `MONITORING_ENABLED=true`.
Because the 50 `local-web` specs self-skip on CI (and the project is absent from the CI
matrix), the main CI matrix discovers the other 137 active tests plus the non-blocking 50-test `monitoring` job. The
`organuz-api` and `agent` projects run only their `@other-smoke`-tagged checks (a tag that
marks the lightweight sanity subset). The disabled `chromium` / `product-setup` /
`product-authenticated` specs still live in the repo, but the default config does not select
them.

The product session-sharing described below applies once the `product-setup` /
`product-authenticated` projects are re-enabled (they are currently commented out in
`playwright.config.ts`; the specs are kept).

The `product-authenticated` project depends on `product-setup`. That setup project logs
each authenticated role (`customer`, `consultant`, `company`) in once and saves its
`storageState` (the saved browser session) to `playwright/.auth/` (gitignored). The
per-role specs then resume that saved session via `test.use({ authRole })` +
`product.resumeSession()` rather than logging in again. This keeps OTP (one-time passcode)
sends down to one per role per run. When a role's saved session is missing (for example,
setup was skipped because of an OTP cooldown), the dependent specs skip with a stated reason
instead of failing.

Per-role credentials are **env-aware** and split per target under `env/` (`env/.dev.env`
default, `env/.prod.env`, selected by `QA_TARGET_ENV`). For each role the runner reads
`<ROLE>_PHONE` / `<ROLE>_OTP_CODE` (`CUSTOMER`, `CONSULTANT`, `COMPANY`), resolved in
`tests/product/support/roleCredentials.ts`, which also accepts a legacy `<ENV>_<ROLE>_PHONE`
form (e.g. `DEV_CUSTOMER_PHONE`); dev uses the fixed OTP `7777`. The real env files are
gitignored; only the `*.example` templates are committed.

Registration coverage lives in the plain `product` project so that it does not trigger the
shared role auth setup. Most registration tests are no-submit validation checks. Only the
full property-owner signup test completes OTP and creates a fresh account.

The active product project also contains explicit gates for side-effecting
paths: `PRODUCT_OTP_UI=true` enables the real OTP-send UI check, and
`PRODUCT_WIZARD_E2E=true` enables authenticated characterization that creates a dev
project.
Geocode-driving wizard cases self-skip on CI; deterministic wizard and mobile checks still run.
