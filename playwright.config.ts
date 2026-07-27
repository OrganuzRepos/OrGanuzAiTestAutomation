import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Env credentials/overrides are split per target env under `env/`:
// `env/.dev.env` (default) and `env/.prod.env`, selected by QA_TARGET_ENV.
// The env-specific file is loaded first (wins); a root `.env`, if present, is a
// fallback for any shared vars not in the env file (dotenv never overrides).
const targetEnv = (process.env.QA_TARGET_ENV || 'dev').toLowerCase();
dotenv.config({ path: path.resolve(__dirname, `env/.${targetEnv}.env`) });
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { config } from './src/utils/config';

const includeLowPriorityTests = process.env.INCLUDE_LOW_PRIORITY_TESTS === 'true';

// External-API monitoring (Govmap + Ofek) is opt-in: it hits live third-party
// services and is meant to FAIL when they break (the alert), so it runs on a
// schedule / on demand, never in the default green suite. Enable with
// MONITORING_ENABLED=true (see `npm run test:monitoring`).
const includeMonitoring = process.env.MONITORING_ENABLED === 'true';

// Debug / human-watch mode: `PW_SLOWMO_MS` slows every browser action by that many
// milliseconds so a person can follow the run with their eyes (paired with
// `--headed --workers=1` — see scripts/run-all-tests.sh --debug). 0 = off (normal
// speed). When on, the test + expect timeouts are widened so the injected per-action
// delays don't trip them. Only affects browser projects; the browserless API projects
// ignore it. Negative values are clamped to 0 (off).
const slowMoMs = Math.max(0, Number(process.env.PW_SLOWMO_MS) || 0);
const debugMode = slowMoMs > 0;
const debugTimeout = Math.max(config.playwright.defaultTimeout, 180_000);
const timeout = debugMode ? debugTimeout : config.playwright.defaultTimeout;
// Debug forces headed so the browser is actually visible. Resolving `headless` here
// (in the config) makes it authoritative — it does not depend on the CLI `--headed`
// flag winning over a project's own `use.headless`. Normal runs stay headless.
const headless = !debugMode;

// Shared browser context for the product app: the product project (and the auth-setup
// project, when re-enabled) use the same origin/viewport so saved sessions restore
// cleanly. baseURL is the calculator app for the selected env (dev / prod).
const productUse = {
  ...devices['Desktop Chrome'],
  baseURL: config.app.baseUrl,
  // Product app is exercised at a 600x800 (narrow) viewport. Set at the project level so
  // the dedicated mobile suite (tests/product/mobile/**) can still override it per-describe
  // with real device profiles via test.use — a project `use` is beaten by a spec `test.use`.
  viewport: { width: 600, height: 800 },
  headless,
};

export default defineConfig({
  testDir: './tests',
  ...(includeLowPriorityTests ? {} : { grepInvert: /@low-priority/ }),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retries heal transient live-site blips (a slow dev-app load that trips a nav
  // timeout, an Axe scan that catches a lazily-rendered node before fonts settle)
  // so a local run lands on the same green result as CI instead of flapping. Local
  // gets 1 retry (CI 2) — the tests themselves are deterministic when run calmly, so
  // a finding that survives a retry is real, not noise. trace/video 'retain-on-failure'
  // keep the artifact from the final failed attempt, so debugging is unaffected.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : config.playwright.workers,
  timeout,
  expect: { timeout },

  reporter: [
    ...(!process.env.PLAYWRIGHT_MERGE_REPORTS
      ? [['blob', { outputDir: 'blob-report/' }] as const]
      : []),
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    [
      'allure-playwright',
      {
        resultsDir: 'allure-results',
        detail: false,
        suiteTitle: true,
        environmentInfo: {
          node_version: process.version,
          playwright_version: require('@playwright/test/package.json').version,
          os: process.platform,
          ci: process.env.CI ? 'true' : 'false',
          web_base_url: config.web.baseUrl,
          app_base_url: config.app.baseUrl,
          organuz_api_base_url: config.organuzApi.baseUrl,
          include_low_priority_tests: includeLowPriorityTests ? 'true' : 'false',
          browser: config.playwright.browser,
          workers: String(config.playwright.workers),
          default_timeout_ms: String(config.playwright.defaultTimeout),
        },
      },
    ],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Record a trace for every test but keep it only when the test fails (works
    // with retries:0 locally, unlike 'on-first-retry'). The retained trace.zip is
    // attached automatically to both the HTML report (interactive Trace viewer)
    // and the Allure report (allure-playwright picks up the attachment).
    trace: 'retain-on-failure',
    // Slow-motion for debug/human-watch runs (browser projects only; no-op at 0).
    ...(slowMoMs > 0 ? { launchOptions: { slowMo: slowMoMs } } : {}),
  },

  projects: [
    // Marketing-site (organuz.ai) UI project is disabled. Re-enable by re-adding
    // `devices` to the import above and uncommenting this block. tests/ui/** is kept.
    // {
    //   name: 'chromium',
    //   testMatch: 'tests/ui/**/*.spec.ts',
    //   grep: /@other-smoke/,
    //   use: {
    //     ...devices['Desktop Chrome'],
    //     baseURL: config.web.baseUrl,
    //     viewport: { width: 1920, height: 1080 },
    //     headless: true,
    //   },
    // },
    // Product app project (targets the *.organuz.com calculator for the selected env).
    // The credential-gated role flows (product-setup / product-authenticated) below
    // stay disabled — re-enable them together when per-role sessions are wired.
    {
      name: 'product',
      testMatch: 'tests/product/**/*.spec.ts',
      // The per-role live specs run in product-authenticated (they need saved sessions).
      testIgnore: 'tests/product/flows/**',
      use: productUse,
    },
    // {
    //   // Authenticates each sign-in role once and saves its storageState. Skip-safe:
    //   // roles without credentials (or when the dev app/OTP is down) are skipped.
    //   name: 'product-setup',
    //   testMatch: 'tests/product/support/auth.setup.ts',
    //   use: productUse,
    // },
    // {
    //   // Live per-role sanity e2e that resume the saved sessions. Depends on the setup
    //   // project; individual specs skip when their role has no saved session.
    //   name: 'product-authenticated',
    //   testMatch: 'tests/product/flows/**/*.spec.ts',
    //   dependencies: ['product-setup'],
    //   use: productUse,
    // },
    {
      // Authorized, non-destructive fraud / account-takeover testing of the Organuz
      // PRODUCT app + auth backend for the selected env (QA_TARGET_ENV: dev default,
      // prod on demand). Browserless APIRequestContext. App-origin checks run on both
      // envs; auth-backend checks self-skip via a reachability canary. A failure is a
      // real finding. baseURL is the env-resolved calculator origin.
      name: 'fraud',
      testMatch: 'tests/fraud/**/*.spec.ts',
      use: {
        baseURL: config.app.baseUrl,
      },
    },
    {
      name: 'organuz-api',
      testMatch: 'tests/organuz-api/**/*.spec.ts',
      grep: /@other-smoke/,
      use: {
        baseURL: config.organuzApi.baseUrl,
      },
    },
    {
      name: 'agent',
      testMatch: 'tests/agent/**/*.spec.ts',
      grep: /@other-smoke/,
    },
    {
      // Authorized penetration testing of the Organuz Supabase backend with the
      // public anon key only (browserless APIRequestContext). Mutating denial probes
      // are skipped unless explicitly acknowledged for a disposable target.
      name: 'security',
      testMatch: 'tests/security/**/*.spec.ts',
      use: {
        baseURL: config.organuzApi.baseUrl,
      },
    },
    // Local-only marketing-site e2e (tests/local-web/**). Registered by default so it runs
    // locally, but EVERY spec self-skips when process.env.CI is set (see tests/local-web/
    // support.ts) and the parallel-tests.yml CI matrix does not list this project — so it
    // never runs on CI. Intentional local/CI divergence (sanctioned skips), per the
    // test-suite-parity skill. Uses a real chromium context against the prod marketing site.
    {
      name: 'local-web',
      testMatch: 'tests/local-web/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: config.web.baseUrl,
        viewport: { width: 1920, height: 1080 },
        headless,
      },
    },
    // CI-enabled accessibility regression suite for the public marketing site.
    // Uses one shared browser context per spec to avoid repeatedly loading prod.
    {
      name: 'accessibility',
      testMatch: 'tests/accessibility/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: config.web.baseUrl,
        viewport: { width: 1440, height: 1000 },
        headless,
      },
    },
    // Opt-in external-dependency monitoring; only registered when MONITORING_ENABLED=true
    // so the default suite never runs live third-party checks.
    ...(includeMonitoring
      ? [
          {
            name: 'monitoring',
            testMatch: 'tests/monitoring/**/*.spec.ts',
          },
        ]
      : []),
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'], baseURL: config.web.baseUrl },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'], baseURL: config.web.baseUrl },
    // },
  ],

  outputDir: 'test-results/',
});
