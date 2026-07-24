# `env/` — per-target environment files

Local overrides + Restricted credentials, split by target environment. The active
file is selected by **`QA_TARGET_ENV`** (default `dev`):

| `QA_TARGET_ENV` | File loaded          | Product target                    | Password gate |
| --------------- | -------------------- | --------------------------------- | ------------- |
| `dev` (default) | `env/.dev.env`       | `dev1.app.organize.organuz.com`   | yes           |
| `prod`          | `env/.prod.env`      | `energy.organuz.com`              | no            |

## Names are unprefixed

Inside each file the variables are **unprefixed** (`CUSTOMER_PHONE`, not
`DEV_CUSTOMER_PHONE`) — the file itself scopes them. `playwright.config.ts` and
`scripts/run-all-tests.sh` load `env/.${QA_TARGET_ENV}.env`; an optional root
`.env` is a shared fallback (the env-specific file wins).

Per-role login uses `<ROLE>_PHONE` / `<ROLE>_OTP_CODE` for `CUSTOMER`,
`CONSULTANT`, `COMPANY` (resolved env-aware in `tests/product/support/roleCredentials.ts`,
which also accepts a legacy `<ENV>_<ROLE>_PHONE` fallback). Dev uses the fixed OTP `7777`.

## Opt-in product and fraud probes

These flags are off by default because they send an OTP, create product data, or
enable diagnostic-only behavior:

| Variable | Effect |
| --- | --- |
| `PRODUCT_OTP_UI=true` | Enables the cellular-login check that requests a real dev OTP. |
| `PRODUCT_WIZARD_E2E=true` | Enables authenticated characterization that can create a real dev project. |
| `FRAUD_AUTH_BACKEND` | Overrides the product auth-backend origin for fraud/ATO checks. |
| `FRAUD_APP_TOKEN` | Overrides the public app token used by the fraud suite. |
| `FRAUD_OTP_VERIFY_CALL` | Names the live OTP verify method required by gated fraud probes. |

## Setup

```bash
cp env/.dev.env.example  env/.dev.env    # fill in Restricted values
cp env/.prod.env.example env/.prod.env   # prod creds (optional locally)
```

The real `env/.dev.env` / `env/.prod.env` are **gitignored** (Restricted — never
commit). Only the `*.example` templates are committed. On CI the prod pipeline
materializes `env/.prod.env` from the `DOTENV_PROD` repo secret.

## Slack alerting

Three optional webhooks — `SLACK_WEBHOOK_URL`, `SLACK_WEBHOOK_BOT_URL`, and
`SLACK_ORGANUZ_TESTING_URL` (the **#organuz-testing** channel). After a run,
`scripts/run-all-tests.sh` posts the run status plus the Allure / Grafana /
Playwright HTML / Scalar report links to **every** webhook that is set (any/all;
an unset one is skipped, a failed post is non-fatal). The CI report-summary step
in `parallel-tests.yml` mirrors this, reading each webhook from a GitHub repo
secret of the same name. `REMOTE_HREF` holds the GitHub repo home for
report/remote links. Smoke-test the wiring with `./scripts/slack-alert-test.sh`.
