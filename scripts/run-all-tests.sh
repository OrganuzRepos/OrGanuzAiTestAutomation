#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

usage() {
  cat <<'EOF'
Usage: run-all-tests.sh [dev|test|prod] [--debug] [-- <playwright args>]

Runs the full local Playwright suite + server stack against a target environment.
The optional env argument selects the environment (default: dev):

  run-all-tests.sh dev     # dev product app (dev1.app.organize.organuz.com), password gate
  run-all-tests.sh prod    # prod product app (energy.organuz.com), no gate
  run-all-tests.sh         # same as dev

  --debug, -d              DEBUG MODE — watch the tests run with your own eyes.
                           Runs headed (visible browser), single-worker (one test
                           at a time), and in slow motion, so it is MUCH slower than
                           a normal run. Slack posting is off by default in this mode.

  -- <playwright args>     Everything after `--` is forwarded verbatim to
                           `npx playwright test`. A `--project`/`-g` here scopes the
                           run (instead of adding to the default project set), so
                           `dev --debug -- --project=product -g @some-tag` watches
                           just those tests.

It sets QA_TARGET_ENV, which drives both the env/.<env>.env file loaded below and
the product baseURL resolved in playwright.config.ts. Env vars still override:
  DEBUG=true               same as --debug (also honored from env/.<env>.env)
  PW_SLOWMO_MS=500         debug slow-motion delay per browser action (default 500)
  MONITORING_ENABLED=true  include the live Govmap/Ofek monitoring project
  NOTIFY_SLACK=false       skip the end-of-run Slack post
  OPEN_BROWSER=false       do not open report tabs
EOF
}

# Parse args: an optional env (dev|test|prod), the --debug/-d flag, and an optional
# `--` after which everything is forwarded verbatim to `npx playwright test`. The env
# is validated so a typo (e.g. `prd`) fails loudly instead of silently running dev; an
# unknown -flag is rejected as an option (not mislabeled as an environment). --debug is
# resolved into DEBUG_MODE below, after the env files are sourced, so DEBUG=true in an
# env file works too.
DEBUG_FLAG=false
ENV_ARG=""
PASSTHROUGH=()
parsing_passthrough=false
for arg in "$@"; do
  if [ "$parsing_passthrough" = "true" ]; then PASSTHROUGH+=("$arg"); continue; fi
  case "$arg" in
    --)         parsing_passthrough=true ;;
    --debug|-d) DEBUG_FLAG=true ;;
    -h|--help)  usage; exit 0 ;;
    dev|test|prod)
      if [ -n "$ENV_ARG" ]; then
        echo "Multiple environments given ('$ENV_ARG' and '$arg')." >&2; usage >&2; exit 2
      fi
      ENV_ARG="$arg" ;;
    -*)         echo "Unknown option '$arg' (see --help; use '--' to pass args to Playwright)." >&2; usage >&2; exit 2 ;;
    *)          echo "Unknown environment '$arg' (expected dev|test|prod)." >&2; usage >&2; exit 2 ;;
  esac
done
if [ -n "$ENV_ARG" ]; then export QA_TARGET_ENV="$ENV_ARG"; fi

# Canonical, lower-cased target env. The CLI arg (when given) wins; otherwise an
# inherited QA_TARGET_ENV; otherwise dev.
TARGET_ENV="$(printf '%s' "${QA_TARGET_ENV:-dev}" | tr '[:upper:]' '[:lower:]')"
echo "Target environment: ${TARGET_ENV}"

# Playwright's TypeScript loader still calls module.register(), which Node 22+/26
# reports as DEP0205 — one line per worker. Silence just that one deprecation so
# the run output stays readable (harmless on Node versions that don't emit it).
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--disable-warning=DEP0205"

# Load the gitignored env files up front so the whole script honors local overrides
# (GRAFANA_URL, PUSHGATEWAY_URL, MONITORING_ENABLED, NOTIFY_SLACK, Slack webhooks)
# the same way Playwright's dotenv does — not just the Slack step at the end.
# Split per target env under env/: env/.dev.env (default) / env/.prod.env, picked
# by TARGET_ENV; a root .env, if present, is a shared fallback. Load the env file
# LAST so it wins (a later 1`set -a; . file` re-assigns).
if [ -f .env ]; then set -a; . ./.env || true; set +a; fi
if [ -f "env/.${TARGET_ENV}.env" ]; then
  set -a; . "./env/.${TARGET_ENV}.env" || true; set +a
else
  echo "Note: env/.${TARGET_ENV}.env not found — copy env/.${TARGET_ENV}.env.example to create it." >&2
fi
# Re-assert the chosen target so an explicit CLI arg stays authoritative even if a
# sourced env file carried a different QA_TARGET_ENV. Exported for the Playwright
# child process (playwright.config.ts resolves the product baseURL from it).
export QA_TARGET_ENV="$TARGET_ENV"

# Resolve debug mode now that the env files are sourced, so DEBUG=true set in
# env/.<env>.env works like the other env overrides (MONITORING_ENABLED, NOTIFY_SLACK).
# The CLI --debug/-d flag also forces it on regardless of the env files.
DEBUG_MODE="${DEBUG:-false}"
if [ "$DEBUG_FLAG" = "true" ]; then DEBUG_MODE=true; fi

# ---- Debug / human-watch mode ----------------------------------------------
# --debug (or DEBUG=true) makes the run watchable by a person: headed browsers,
# one test at a time, and slow motion (PW_SLOWMO_MS, read by playwright.config.ts).
# This is MUCH slower than a normal run — that is the point. Slack posting defaults
# off here so an interactive debug session does not ping the team.
DEBUG_PW_ARGS=()
if [ "$DEBUG_MODE" = "true" ]; then
  export PW_SLOWMO_MS="${PW_SLOWMO_MS:-500}"
  DEBUG_PW_ARGS=(--headed --workers=1)
  NOTIFY_SLACK="${NOTIFY_SLACK:-false}"
  echo "==============================================================="
  echo " DEBUG MODE: headed + single-worker + slow motion (${PW_SLOWMO_MS}ms/action)."
  echo " A browser window will open and drive each test slowly so you can watch."
  echo " This is MUCH slower than a normal run. Ctrl-C to stop early."
  echo "==============================================================="
  if [ -n "${CI:-}" ] || [ -f /.dockerenv ]; then
    echo "Warning: no display detected (CI/container) — headed mode may fail here." >&2
  fi
fi

echo "Running TypeScript typecheck..."
npx tsc --noEmit

API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
AUTO_START_API="${AUTO_START_API:-true}"
FASTAPI_URL="${FASTAPI_URL:-http://localhost:8000}"
SWAGGER_URL="${SWAGGER_URL:-http://localhost:8080}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9092}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"
GRAFANA_DASHBOARD_URL="${GRAFANA_DASHBOARD_URL:-${GRAFANA_URL}/d/organuz-system-tests/organuz-system-and-test-monitor}"
ALLURE_URL="${ALLURE_URL:-http://localhost:5050}"
PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://localhost:9091}"
# Playwright's own default HTML report (written to playwright-report/ by the `html`
# reporter). Served at the end alongside Allure via `playwright show-report`.
PLAYWRIGHT_REPORT_PORT="${PLAYWRIGHT_REPORT_PORT:-9323}"
PLAYWRIGHT_REPORT_URL="${PLAYWRIGHT_REPORT_URL:-http://localhost:${PLAYWRIGHT_REPORT_PORT}}"

api_ready() {
  curl -fsS "${API_BASE_URL}/health" >/dev/null 2>&1
}

stack_ready() {
  api_ready \
    && curl -fsS "${SWAGGER_URL}" >/dev/null 2>&1 \
    && curl -fsS "${PROMETHEUS_URL}/-/ready" >/dev/null 2>&1 \
    && curl -fsS "${GRAFANA_URL}/api/health" >/dev/null 2>&1
}

if [ "$AUTO_START_API" = "true" ] && [ "$API_BASE_URL" = "http://localhost:8000" ] && ! stack_ready; then
  echo "Starting local FastAPI, Scalar, Prometheus, and Grafana servers with Docker Compose..."
  docker compose up -d --build api swagger prometheus grafana pushgateway
fi

echo "Waiting for FastAPI server at ${API_BASE_URL}/health..."
for i in $(seq 1 30); do
  if api_ready; then
    echo "FastAPI server is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "FastAPI server did not become ready in time." >&2
    echo "Start it manually with: docker compose up -d --build api" >&2
    exit 1
  fi
  sleep 1
done

echo "Running all Playwright tests..."
# Start from a clean Allure results dir so the report reflects THIS run and not
# leftovers from an ad-hoc single-project run (a stale dir made the report show
# only whatever ran last).
rm -rf allure-results
set +e
# Every real, non-credential-gated project we WANT in the aggregated Allure report:
# marketing UI, Supabase contract, the product data-contracts + skip-safe public
# sanity, the stubbed agent specs, and the always-local web sanity. Opt-in live
# Govmap/Ofek monitoring joins when MONITORING_ENABLED=true. The credential-gated
# product-setup/product-authenticated role flows stay out.
DESIRED_PROJECTS=(chromium organuz-api product agent security fraud accessibility local-web)
if [ "${MONITORING_ENABLED:-}" = "true" ]; then
  echo "MONITORING_ENABLED=true — requesting the live Govmap/Ofek monitoring project."
  DESIRED_PROJECTS+=(monitoring)
fi

# Intersect the wanted list with the projects Playwright ACTUALLY has configured
# for this env, so a project currently commented out in playwright.config.ts is
# skipped with a note instead of aborting the whole run ("Project(s) 'x' not found").
# `--list` loads the same config (same QA_TARGET_ENV), so the set is accurate.
# Override reporters: Allure otherwise records every discovered test as skipped,
# polluting the real report with tests that were never selected for execution.
AVAILABLE_PROJECTS="$(npx playwright test --list --reporter=list 2>/dev/null \
  | awk 'match($0, /\[[a-z0-9-]+\]/) { print substr($0, RSTART + 1, RLENGTH - 2) }' \
  | sort -u)"

PROJECT_ARGS=()
for p in "${DESIRED_PROJECTS[@]}"; do
  if printf '%s\n' "$AVAILABLE_PROJECTS" | grep -qx "$p"; then
    PROJECT_ARGS+=(--project="$p")
  else
    echo "Note: project '$p' is not configured for ${TARGET_ENV} — skipping."
  fi
done

# If the user selected projects via passthrough (`-- --project=…`), let that fully
# drive project selection instead of layering the default DESIRED_PROJECTS on top
# (multiple --project flags ADD projects, they don't scope down). A bare `-g`/other
# passthrough is still additive and applies across the default project set.
USER_PROJECTS=false
for a in ${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}; do
  case "$a" in --project|--project=*) USER_PROJECTS=true ;; esac
done

if [ "$USER_PROJECTS" = "true" ]; then
  echo "Using project selection from passthrough args."
  npx playwright test ${DEBUG_PW_ARGS[@]+"${DEBUG_PW_ARGS[@]}"} "${PASSTHROUGH[@]}"
elif [ "${#PROJECT_ARGS[@]}" -eq 0 ]; then
  echo "No requested projects are configured — running the full default suite." >&2
  npx playwright test ${DEBUG_PW_ARGS[@]+"${DEBUG_PW_ARGS[@]}"} ${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}
else
  echo "Running projects:${PROJECT_ARGS[*]//--project=/ }"
  npx playwright test "${PROJECT_ARGS[@]}" ${DEBUG_PW_ARGS[@]+"${DEBUG_PW_ARGS[@]}"} ${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}
fi
TEST_EXIT_CODE=$?
set -e

if [ -d allure-results ] && [ "$(find allure-results -mindepth 1 -print -quit)" ]; then
  echo "Generating Allure 3 report..."
  # Carry Allure history forward so the report keeps its Trend / Retries / History
  # graphs across local runs: seed THIS run's results with the PREVIOUS report's
  # history/ before (re)generating. allure-results is wiped each run (line above), so
  # without this the trend would reset every time. First run has no prior report — fine.
  if [ -d allure-report/history ]; then
    mkdir -p allure-results/history
    cp -R allure-report/history/. allure-results/history/
    echo "Carried Allure history forward from the previous report."
  fi
  mkdir -p allure-report
  find allure-report -mindepth 1 -delete
  npx -y -p allure@3 allure generate allure-results --output allure-report
fi

if [ "$AUTO_START_API" = "true" ] && [ "$API_BASE_URL" = "http://localhost:8000" ]; then
  # Ensure every local server is running at the end of the run — the start-up
  # block above is conditional (skipped when the stack already looked ready), so
  # bring them all up explicitly here. `up -d` is idempotent for ones already up.
  echo "Bringing up all local servers (FastAPI, Scalar, Prometheus, Grafana, Pushgateway, Allure)..."
  docker compose up -d --build api swagger prometheus grafana pushgateway allure \
    || echo "One or more servers could not start; check 'docker compose ps'."

  # Force-recreate the Allure server so it serves the freshly generated report.
  docker compose up -d --force-recreate allure \
    || echo "Allure report server could not start on ${ALLURE_URL}."

  # Push this run's QA metrics to the Pushgateway (Prometheus then scrapes it).
  # This replaces the old "restart api so it re-reads the stale test-results bind
  # mount" hack — metrics are pushed now, so there is no file/inode to go stale.
  echo "Pushing QA metrics to Pushgateway at ${PUSHGATEWAY_URL}..."
  for i in $(seq 1 15); do
    curl -fsS "${PUSHGATEWAY_URL}/-/ready" >/dev/null 2>&1 && break
    sleep 1
  done
  # Wait for the Playwright JSON report to be on disk before pushing. It is written
  # as the test process exits; on a big multi-project run it can land a beat after
  # the summary prints, so guard against reading too early (else we'd push
  # report_present=0 and blank the dashboard).
  RESULTS_PATH="${QA_PLAYWRIGHT_RESULTS_PATH:-test-results/results.json}"
  for i in $(seq 1 10); do
    [ -s "$RESULTS_PATH" ] && break
    sleep 1
  done
  PUSHGATEWAY_URL="$PUSHGATEWAY_URL" node scripts/push-qa-metrics.mjs \
    || echo "Could not push QA metrics; Grafana test panels may be empty."
fi

echo
echo "Local servers:"
echo "  FastAPI:      ${FASTAPI_URL}"
echo "  Scalar:       ${SWAGGER_URL}"
echo "  Prometheus:   ${PROMETHEUS_URL}"
echo "  Pushgateway:  ${PUSHGATEWAY_URL}"
echo "  Grafana:      ${GRAFANA_URL}"
echo "Test reports:"
echo "  Allure:       ${ALLURE_URL}"
echo "  Playwright:   ${PLAYWRIGHT_REPORT_URL}  (default HTML report)"
echo

OPEN_BROWSER="${OPEN_BROWSER:-auto}"
if [ "$OPEN_BROWSER" = "auto" ]; then
  if [ -n "${CI:-}" ] || [ -f /.dockerenv ]; then
    OPEN_BROWSER="false"
  else
    OPEN_BROWSER="true"
  fi
fi

if [ "$OPEN_BROWSER" = "true" ]; then
  if command -v open >/dev/null 2>&1; then
    OPENER="open"
  elif command -v xdg-open >/dev/null 2>&1; then
    OPENER="xdg-open"
  else
    OPENER=""
  fi

  # Serve Playwright's default HTML report in the background so it shows up next to the
  # Allure report. `show-report` binds the port and opens its own browser tab, then keeps
  # serving (like the docker Allure server) so the report stays viewable after the script
  # exits. Backgrounded + disowned so it never blocks the run.
  if [ -d playwright-report ]; then
    echo "Serving Playwright HTML report at ${PLAYWRIGHT_REPORT_URL} ..."
    (npx playwright show-report playwright-report --host localhost --port "$PLAYWRIGHT_REPORT_PORT" >/dev/null 2>&1 &) \
      || echo "Could not start the Playwright HTML report server on ${PLAYWRIGHT_REPORT_URL}."
  else
    echo "No playwright-report/ directory — skipping the Playwright HTML report."
  fi

  if [ -n "$OPENER" ]; then
    echo "Opening servers and the Allure report in browser..."
    # The Allure report opens here; the Playwright HTML report opens itself via the
    # backgrounded `show-report` above, so it is not repeated in this loop.
    for url in "${FASTAPI_URL}/docs" "${SWAGGER_URL}" "${PROMETHEUS_URL}" "${GRAFANA_DASHBOARD_URL}" "${ALLURE_URL}"; do
      "$OPENER" "$url" >/dev/null 2>&1 || true
    done
  else
    echo "No browser opener found (set OPEN_BROWSER=false to silence)."
  fi
fi

# ---- Slack notification -----------------------------------------------------
# Once the run has finished, post the report links (Allure + Grafana) to every
# configured Slack channel (SLACK_WEBHOOK_URL, SLACK_WEBHOOK_BOT_URL, and the
# organuz-testing channel SLACK_ORGANUZ_TESTING_URL), mirroring the CI
# report-summary step. Webhooks come from the
# gitignored env/.<env>.env (or the environment); each is optional (unset = skipped)
# and a failed post never breaks the run. Disable with NOTIFY_SLACK=false.
NOTIFY_SLACK="${NOTIFY_SLACK:-true}"
if [ "$NOTIFY_SLACK" = "true" ]; then
  # The env files were already sourced at the top of the script.
  SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
  SLACK_WEBHOOK_BOT_URL="${SLACK_WEBHOOK_BOT_URL:-}"
  SLACK_ORGANUZ_TESTING_URL="${SLACK_ORGANUZ_TESTING_URL:-}"
  if [ -n "$SLACK_WEBHOOK_URL" ] || [ -n "$SLACK_WEBHOOK_BOT_URL" ] || [ -n "$SLACK_ORGANUZ_TESTING_URL" ]; then
    if [ "$TEST_EXIT_CODE" -eq 0 ]; then
      SLACK_STATUS=":white_check_mark: passed"
    else
      SLACK_STATUS=":x: failed (exit ${TEST_EXIT_CODE})"
    fi
    SLACK_TEXT=":bar_chart: *Organuz — Local test run* (\`${TARGET_ENV}\`) finished — ${SLACK_STATUS}\n• <${ALLURE_URL}|Allure report>\n• <${GRAFANA_DASHBOARD_URL}|Grafana dashboard>\n• <${PLAYWRIGHT_REPORT_URL}|Playwright HTML report>\n• <${SWAGGER_URL}|Scalar API docs>"
    SLACK_PAYLOAD=$(printf '{"text":"%s"}' "$SLACK_TEXT")
    slack_post() { # $1 = label, $2 = url
      if [ -z "$2" ]; then echo "  $1: not set — skipping."; return 0; fi
      if curl -fsS -X POST "$2" -H 'content-type: application/json' --data "$SLACK_PAYLOAD" >/dev/null 2>&1; then
        echo "  $1: posted."
      else
        echo "  $1: post failed (non-fatal)."
      fi
    }
    echo "Posting report links to Slack..."
    slack_post SLACK_WEBHOOK_URL "$SLACK_WEBHOOK_URL"
    slack_post SLACK_WEBHOOK_BOT_URL "$SLACK_WEBHOOK_BOT_URL"
    slack_post SLACK_ORGANUZ_TESTING_URL "$SLACK_ORGANUZ_TESTING_URL"
  else
    echo "No SLACK_WEBHOOK_URL / SLACK_WEBHOOK_BOT_URL / SLACK_ORGANUZ_TESTING_URL set — skipping Slack notification."
  fi
fi

echo "Test run complete."
exit "$TEST_EXIT_CODE"
