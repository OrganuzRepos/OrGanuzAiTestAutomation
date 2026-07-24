# QA MCP Agent

A TypeScript orchestrator (a coordinator that drives the whole run) that ties
four systems together to run the test suite end-to-end and report results,
following the architecture designed for this project. Before a run, it can
optionally enrich test cases with acceptance criteria (the conditions a case
must satisfy to pass) parsed from requirements documents (PDF / DOCX / XLSX).

```
        Azure DevOps                         Playwright
     (test cases, bugs)                   (browser E2E tests)
              \                                  /
               \                                /
                +----------  QA agent  ---------+
               /          (orchestrator)        |\
              /                |                 | \
       Google Sheets           |             OneDrive
     (test data, reports)      |        (artifacts + requirements
                               |             doc download)
                       Requirements docs
                     (PDF / DOCX / XLSX, local
                      FS or OneDrive) -> enrich
                       acceptance criteria
```

## Roles

| System            | Direction | Role |
| ----------------- | --------- | ---- |
| Azure DevOps      | in + out  | System of record. Reads suite + acceptance criteria; writes pass/fail and files bugs. Kept **read-only** until the reporting step. |
| Google Sheets     | in + out  | Parametrised test data + environments in; live results log out. **No secrets** — only references. |
| Playwright        | exec      | Browser/API execution engine. Offline demos use `StubPlaywrightRunner`; real repository runs use `CliPlaywrightRunner` to invoke `npx playwright test`. |
| OneDrive          | in + out  | Durable evidence store (returns shareable links embedded in bugs/reports) and the optional source for requirements docs (`downloadFiles`). |
| Requirements docs | in (opt.) | PDF / DOCX / XLSX read from local FS or OneDrive, parsed and matched by case id to enrich acceptance criteria. Handled by `utils/RequirementsReader`. |

## The agent loop (`Orchestrator.run`)

1. Read the target suite + acceptance criteria from Azure DevOps Test Plans.
   1.5. **(Optional)** When `requirements.path` is set, load requirements docs
   (from OneDrive when `source: 'onedrive'`, otherwise local FS), parse
   PDF/DOCX/XLSX, and match them to cases by id to enrich `acceptanceCriteria`.
2. Pull matching data rows + target environment from Google Sheets.
3. For each case, Playwright executes the flow and asserts expected vs actual.
4. Push screenshots/video/trace to OneDrive and keep links.
5. Write pass/fail back onto the case; on failure file a bug **idempotently**
   (skips if an open bug already exists) with repro steps, environment, and
   evidence links; append a row to the results sheet.
6. Re-run flagged-flaky failures once, then emit a run summary (including a
   `requirementsSummary` of which docs matched which cases, when enabled).

## Design decisions encoded here

- **Read-only scoping / blast radius** — `AzureDevOpsConnector.setReadOnly` is
  held read-only while reading the plan and only widened for the reporting step.
- **Idempotency** — `findOpenBug` is queried before `fileBug` so re-runs never
  spawn duplicate bugs.
- **Flaky handling** — a case tagged `@flaky` that fails is re-run once; passing
  the re-run marks it `flaky` rather than `failed`.
- **CLI-backed project execution** — `CliPlaywrightRunner` maps a case data row
  to Playwright CLI arguments (`project`, `testFile`, `grep`, `grepInvert`),
  runs `npx playwright test`, reads `test-results/results.json`, and returns a
  normalized `ExecutionResult`.
- **Requirements enrichment** — when enabled, `RequirementsReader` parses
  PDF/DOCX/XLSX docs and matches them to cases by id (Excel: a `Case ID`-style
  column; PDF/DOCX: `[TC-1]`, `TC-1:`, `TC-1 -` patterns, with a sentence-level
  fallback). Matches are appended to `acceptanceCriteria` and de-duplicated;
  parse failures are logged and skipped, never fatal.
- **Per-case resilience** — runner crashes, evidence upload failures, Azure
  DevOps write-back errors, and Sheets result-log errors are caught at the case
  boundary so one bad connector call does not abort the entire suite. Unexpected
  runner crashes are marked `blocked` with a diagnostic log artifact.
- **Secrets** — environments carry a `credentialRef` / `storageStateRef`, never
  the secret itself; resolved from a secret store at runtime.

## Run the offline demo

```bash
npm run agent:demo
```

Everything is wired to in-memory stub connectors, so it runs offline and prints
a JSON run summary. The seed (`demo/seed.ts`) exercises all paths: a pass, a
failure that files a bug, a flaky case that recovers on re-run, and a blocked
case with no data row.

## Generate a test plan from a URL (`TestPlanAgent`)

The `Orchestrator` *reads* a plan from Azure DevOps and runs it. The
`TestPlanAgent`, by contrast, *drafts* one from a live page. Give it a **URL**
and it explores the page through a `PageExplorer`, then builds a `TestSuite`
from what it finds: a page-load case, a headings case, one reachability case per
navigation link, and one case per form. It produces this in the exact shape the
`Orchestrator` consumes, so a generated plan can flow straight into the run
loop.

```bash
npm run agent:plan -- https://www.organuz.ai            # offline stub (default)
npm run agent:plan -- https://www.organuz.ai --live     # real browser via the Playwright MCP CLI server
npm run agent:plan -- https://www.organuz.ai --live --headed
```

The offline path (the default) uses `StubPageExplorer` — deterministic, with no
browser or network.

The **live** path uses the real **Playwright MCP CLI server** (MCP is the Model
Context Protocol, the standard the browser tools speak over). `McpCliPlaywrightClient`
launches `npx @playwright/mcp` over stdio (via `@modelcontextprotocol/sdk`) and
forwards `navigate`/`snapshot` to the server's `browser_navigate` /
`browser_snapshot` tools. `parseMcpSnapshotText` then extracts the page URL/title
and the fenced-yaml aria tree (the page's accessibility structure), and
`parseSnapshot` turns that into the `PageExploration` the agent plans from. The
SDK and server are **optional** `devDependencies`, loaded lazily, so the offline
path needs neither.

```ts
import { McpCliPlaywrightClient, McpPageExplorer, TestPlanAgent } from './src/agent';

const client = new McpCliPlaywrightClient({ headless: true }); // spawns the package-lock-pinned @playwright/mcp
try {
  const suite = await new TestPlanAgent(new McpPageExplorer(client)).generatePlan('https://www.organuz.ai');
} finally {
  await client.close(); // stops the MCP server subprocess
}
```

`McpCliPlaywrightClient` defaults to `--isolated` (a fresh browser profile per
run), so it never hits the "Browser is already in use" lock. Any object that
matches the `PlaywrightMcpClient` interface also works — for example, an
in-session MCP tool binding, or a fake used in tests.

## Run the current repository tests through the agent

```bash
npm run agent:current-tests
```

This keeps Azure DevOps, Google Sheets, and OneDrive stubbed (replaced by
in-memory fakes), but uses `CliPlaywrightRunner` to invoke the real Playwright
CLI. The generated suite currently maps three orchestrator cases to the active
repository projects represented by `src/agent/run-current-tests.ts`:

- `PW-API` -> `npx playwright test --project=organuz-api`
- `PW-PRODUCT` -> `npx playwright test --project=product`
- `PW-AGENT` -> `npx playwright test --project=agent`

Set `WEB_BASE_URL`, `QA_TARGET_ENV`, or `APP_BASE_URL` before running if you want
to point the UI or product projects at non-default targets. The product live
browser flows stay gated (held back) unless `PRODUCT_E2E_ENABLED=true` and persona
credentials are present. `organuz-api` and `agent` are filtered by their Playwright
project configuration to their `@other-smoke` checks. The command exits non-zero
(signals failure) if any mapped project fails or becomes blocked.

The current-test runner keeps the external systems stubbed:

| Connector | Current-test behavior |
| --- | --- |
| Azure DevOps | In-memory suite and result/bug writes. |
| Google Sheets | In-memory environment/data rows and result log. |
| OneDrive | Synthetic evidence URLs for Playwright HTML report and JSON result artifacts. |
| Playwright | Real CLI execution of configured projects. |

In restricted sandboxes (locked-down environments with limited access),
`organuz-api` can fail on DNS/network access and the browser projects can fail on
launch permissions. On a normal local run, those same projects should behave just
like direct Playwright commands.

## Requirements-document enrichment

Point the agent at a file or folder of requirements docs and it will enrich the
matching cases' acceptance criteria before the run:

```bash
QA_REQUIREMENTS_PATH=test-requirements-docs QA_REQUIREMENTS_SOURCE=local npm run agent:demo
```

To generate a sample set (one `.pdf`, `.docx`, and `.xlsx` under
`test-requirements-docs/`, each seeded with `TC-10x` references) for a quick
local try:

```bash
npm run agent:build && node dist/src/agent/demo/generate-test-files.js
```

Parsing is backed by `pdf-parse`, `mammoth`, and `xlsx`. Set
`QA_REQUIREMENTS_SOURCE=onedrive` to download the docs through the OneDrive
connector instead of reading the local filesystem.

## Going from stubs to real connectors

Every connector (the code that talks to one external system) is an interface with
a `Stub*` implementation. Replace a stub with a real REST/MCP-backed class **behind
the same interface**, and the orchestrator stays unchanged:

| Interface                | Real backing |
| ------------------------ | ------------ |
| `AzureDevOpsConnector`   | Azure DevOps REST API / MCP (`wit`, test plans), honour `X-MCP-Readonly`. |
| `GoogleSheetsConnector`  | Google Sheets API. |
| `OneDriveConnector`      | Microsoft Graph (OneDrive) — both artifact upload and requirements `downloadFiles`. |
| `PlaywrightRunner`       | `StubPlaywrightRunner` (offline demo) or `CliPlaywrightRunner` (real `npx playwright test`); Playwright MCP for authoring. |

`RequirementsReader` (`utils/`) is not a swappable connector. It reads either from
the local filesystem or from buffers (in-memory file contents) that the
`OneDriveConnector` hands it.

## Mapping cases to Playwright CLI slices

`CliPlaywrightRunner` reads these optional keys from `DataRow.inputs`:

| Input key | Example | Effect |
| --- | --- | --- |
| `project` | `organuz-api,chromium` | Adds one `--project=` argument per comma-separated project. |
| `testFile` | `tests/organuz-api/contracts/projects-contract.spec.ts` | Runs a specific file or directory. |
| `grep` | `@smoke` | Adds Playwright `--grep`. |
| `grepInvert` | `@intentionally-failing` | Adds Playwright `--grep-invert`. |

The runner records a single step whose expected value is exit code `0` (the
success code). It then uses Playwright's JSON report to populate totals and
failure messages.

## Configuration

Env-driven (`config.ts`); see `.env.example`. Key variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ADO_PLAN_ID` / `ADO_SUITE_ID` | `PLAN-1` / `SUITE-1` | Target test plan + suite. |
| `ADO_START_READONLY` | `true` | Hold Azure DevOps read-only until the reporting step. |
| `QA_ENVIRONMENT` | `staging` | Environment name resolved from Sheets. |
| `QA_RERUN_FLAKY` / `QA_FLAKY_TAG` | `true` / `@flaky` | Single flaky re-run and the tag that opts in. |
| `QA_FILE_BUGS` | `true` | File bugs on failure (off = report only). |
| `QA_MAX_CASES` | `0` | Cap cases per run; `0` = no limit. |
| `QA_EVIDENCE_PREFIX` | `qa-runs` | OneDrive evidence folder prefix. |
| `QA_REQUIREMENTS_PATH` | `` (off) | File or folder of requirements docs to enrich from. |
| `QA_REQUIREMENTS_SOURCE` | `local` | `local` filesystem or `onedrive` download. |

## Layout

```
src/agent/
  Orchestrator.ts          the agent loop
  config.ts                env-driven configuration
  types.ts                 transport-agnostic domain contract
  index.ts                 barrel exports
  run-current-tests.ts     run the repo's Playwright projects via the agent
  connectors/              AzureDevOps, GoogleSheets, OneDrive, Playwright (+ stubs)
  services/                orchestration helpers for requirements, summaries, and text formatting
  utils/RequirementsReader.ts   PDF/DOCX/XLSX parsing + case matching
  demo/                    seed data, offline demo, sample-doc generator
tests/agent/orchestrator/  orchestrator unit/integration specs (Playwright `agent` project)
```
