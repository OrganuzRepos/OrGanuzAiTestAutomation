import { APIRequestContext, test } from '@playwright/test';

/**
 * Shared helpers for the `qa-api` project — the local FastAPI service that backs the QA
 * dashboard (health, automation metadata, Prometheus metrics, and the OpenAPI document
 * the Scalar reference renders).
 *
 * That service had no tests at all: the CI `services-smoke` job curled /health for a 200
 * and stopped there, so everything it actually serves — the automation metadata, the
 * response shapes, the OpenAPI contract — was unverified. Its advertised Playwright
 * project list had consequently drifted to name three projects that no longer existed.
 */

/** The API under test. Overridable so the suite can point at a hosted deployment. */
export const QA_API_BASE_URL = (process.env.FASTAPI_URL ?? 'http://localhost:8000').replace(/\/$/, '');

/**
 * The Scalar UI's origin, used for the CORS check. Follows SCALAR_PORT for the same
 * reason the server's own allow-list does: the host port is overridable, and hardcoding
 * 8080 is what previously left the API reference unable to fetch /openapi.json.
 */
export const SCALAR_ORIGIN = process.env.SWAGGER_URL
  ?? `http://localhost:${process.env.SCALAR_PORT ?? '8080'}`;

/** Endpoints this suite treats as the service's public surface. */
export const QA_API_PATHS = [
  '/',
  '/health',
  '/automation',
  '/automation/playwright-projects',
  '/automation/qa-agent',
] as const;

let cachedReason: string | null | undefined;

/**
 * Why the API is unreachable, or null when it is up.
 *
 * The stack is Docker Compose and is NOT running by default: locally it comes up via
 * `scripts/run-all-tests.sh`, and on CI only inside the `services-smoke` job. A suite
 * that hard-failed without it would make a plain `npx playwright test` red on every
 * machine that simply hasn't started the containers, so an unreachable API is a skip —
 * the same canary policy as the `monitoring` project. Anything the API answers is then
 * asserted strictly: a reachable-but-wrong response is a real failure.
 */
export async function qaApiBlockReason(request: APIRequestContext): Promise<string | null> {
  if (cachedReason !== undefined) return cachedReason;
  try {
    const response = await request.get(`${QA_API_BASE_URL}/health`, { timeout: 5_000 });
    cachedReason = response.ok()
      ? null
      : `the QA API answered /health with HTTP ${response.status()}`;
  } catch (error) {
    cachedReason =
      `the QA API is not reachable at ${QA_API_BASE_URL} — start the stack with `
      + `\`docker compose up -d api\` (${(error as Error).message.split('\n')[0]})`;
  }
  return cachedReason;
}

/** Skip the current test when the local service stack is not running. */
export async function skipWhenQaApiIsDown(request: APIRequestContext): Promise<void> {
  const reason = await qaApiBlockReason(request);
  test.skip(reason !== null, reason ?? '');
}
