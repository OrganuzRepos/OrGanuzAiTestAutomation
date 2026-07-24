import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field


# Origins allowed to call the API from a browser (the Scalar/Swagger UI). Locally
# this is the swagger container on :8080; on a hosted deploy (e.g. Railway) set
# CORS_ALLOW_ORIGINS to the public swagger URL(s), comma-separated.
def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS", "")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins or ["http://localhost:8080", "http://127.0.0.1:8080"]


class ServiceStatus(BaseModel):
    status: str = Field(examples=["ok"])


class RootInfo(BaseModel):
    message: str
    docs_url: str
    openapi_url: str


class PlaywrightProject(BaseModel):
    name: str
    test_match: str
    command: str
    purpose: str


class AgentCommand(BaseModel):
    name: str
    command: str
    runner: str
    description: str


class AutomationOverview(BaseModel):
    projects: list[PlaywrightProject]
    agent_commands: list[AgentCommand]
    reports: list[str]


PLAYWRIGHT_PROJECTS = [
    PlaywrightProject(
        name="chromium",
        test_match="tests/ui/**/*.spec.ts",
        command="npx playwright test --project=chromium",
        purpose="Runs UI tests against the OrGanuz marketing site.",
    ),
    PlaywrightProject(
        name="product",
        test_match="tests/product/**/*.spec.ts",
        command="npx playwright test --project=product",
        purpose="Runs the product E2E matrix for personas, calculator, quotations, and access control.",
    ),
    PlaywrightProject(
        name="api",
        test_match="tests/api/**/*.spec.ts",
        command="npx playwright test --project=api",
        purpose="Runs API tests against JSONPlaceholder or the local mock.",
    ),
    PlaywrightProject(
        name="agent",
        test_match="tests/agent/**/*.spec.ts",
        command="npx playwright test --project=agent",
        purpose="Runs QA agent orchestrator regression tests.",
    ),
]

AGENT_COMMANDS = [
    AgentCommand(
        name="offline-demo",
        command="npm run agent:demo",
        runner="StubPlaywrightRunner",
        description=(
            "Runs the QA agent loop with in-memory Azure DevOps, Sheets, "
            "OneDrive, and Playwright stubs."
        ),
    ),
    AgentCommand(
        name="current-tests",
        command="npm run agent:current-tests",
        runner="CliPlaywrightRunner",
        description=(
            "Maps PW-API, PW-CHROMIUM, PW-PRODUCT, and PW-AGENT cases to the real "
            "Playwright CLI projects."
        ),
    ),
]

app = FastAPI(
    title="OrGanuz Test Automation API",
    summary="Local documentation, health, metrics, and automation metadata for the OrGanuz test stack.",
    description=(
        "Swagger/OpenAPI surface for the local OrGanuz automation support service. "
        "The service exposes health and metrics endpoints plus read-only metadata "
        "for the Playwright projects and QA agent orchestrator commands."
    ),
    version="1.1.0",
    contact={
        "name": "OrGanuz QA Automation",
    },
    license_info={
        "name": "Internal",
    },
    openapi_tags=[
        {"name": "service", "description": "Runtime service health and root metadata."},
        {"name": "automation", "description": "Read-only metadata for Playwright and QA agent workflows."},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exposes process_* / up / http_* metrics at /metrics. The QA test metrics
# (qa_playwright_*) are no longer produced here — the test runner pushes them to
# the Prometheus Pushgateway (see scripts/push-qa-metrics.mjs).
Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.get("/", response_model=RootInfo, tags=["service"], summary="Service metadata")
def root() -> RootInfo:
    return RootInfo(
        message="FastAPI server is running",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )


@app.get("/health", response_model=ServiceStatus, tags=["service"], summary="Health check")
def health() -> ServiceStatus:
    return ServiceStatus(status="ok")


@app.get(
    "/automation",
    response_model=AutomationOverview,
    tags=["automation"],
    summary="Automation stack overview",
)
def automation_overview() -> AutomationOverview:
    return AutomationOverview(
        projects=PLAYWRIGHT_PROJECTS,
        agent_commands=AGENT_COMMANDS,
        reports=[
            "playwright-report",
            "test-results/results.json",
            "allure-results",
            "allure-report",
            "blob-report",
        ],
    )


@app.get(
    "/automation/playwright-projects",
    response_model=list[PlaywrightProject],
    tags=["automation"],
    summary="Configured Playwright projects",
)
def playwright_projects() -> list[PlaywrightProject]:
    return PLAYWRIGHT_PROJECTS


@app.get(
    "/automation/qa-agent",
    response_model=list[AgentCommand],
    tags=["automation"],
    summary="QA agent commands",
)
def qa_agent_commands() -> list[AgentCommand]:
    return AGENT_COMMANDS
