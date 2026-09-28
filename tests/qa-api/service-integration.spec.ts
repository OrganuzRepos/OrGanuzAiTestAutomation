/**
 * Integration sanity for the local QA API (FastAPI) — does the service actually serve
 * what the dashboard and the Scalar reference depend on?
 *
 * Before this suite the service had no tests: CI's `services-smoke` job curled /health
 * for a 200 and stopped, so every response body it returns was unverified.
 *
 * Browserless (APIRequestContext). Skip-safe: the Docker stack is not running by default,
 * so an unreachable API skips with a reason (see qaApiBlockReason). A reachable-but-wrong
 * response always fails.
 */
import { test, expect } from '../../src/fixtures';
import { HttpStatus } from '../../src/utils/httpStatus';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../src/utils/allure';
import {
  QA_API_BASE_URL,
  QA_API_PATHS,
  SCALAR_ORIGIN,
  skipWhenQaApiIsDown,
} from './support/qaApi';

test.describe('QA API integration', { tag: ['@qa-api', '@integration'] }, () => {
  test.beforeEach(async ({ request }) => {
    await allureEpic('QA dashboard API');
    await allureFeature('Service integration');
    await skipWhenQaApiIsDown(request);
  });

  test('QAAPI-01 the service reports itself healthy', async ({ request }) => {
    await allureStory('Health');
    await allureSeverity('critical');

    const response = await request.get(`${QA_API_BASE_URL}/health`);
    expect(response.status(), 'health responds 200').toBe(HttpStatus.OK);
    expect(await response.json(), 'health reports ok').toEqual({ status: 'ok' });
  });

  test('QAAPI-02 the root points at its own docs and OpenAPI document', async ({ request }) => {
    await allureStory('Service metadata');
    await allureSeverity('normal');

    const body = await (await request.get(`${QA_API_BASE_URL}/`)).json();
    expect(body.message, 'the root announces the running service').toBeTruthy();
    // These are advertised to clients, so they must point somewhere real, not just exist.
    expect(body.docs_url, 'the advertised docs path').toBe('/docs');
    expect(body.openapi_url, 'the advertised OpenAPI path').toBe('/openapi.json');

    for (const path of [body.docs_url, body.openapi_url]) {
      const linked = await request.get(`${QA_API_BASE_URL}${path}`);
      expect(linked.status(), `the advertised ${path} is actually served`).toBe(HttpStatus.OK);
    }
  });

  test('QAAPI-03 every documented endpoint answers', async ({ request }) => {
    await allureStory('Endpoint availability');
    await allureSeverity('critical');

    for (const path of QA_API_PATHS) {
      const response = await request.get(`${QA_API_BASE_URL}${path}`);
      expect(response.status(), `GET ${path} answers 200`).toBe(HttpStatus.OK);
      expect(
        response.headers()['content-type'] ?? '',
        `GET ${path} answers JSON`,
      ).toContain('application/json');
    }
  });

  test('QAAPI-04 the automation overview carries projects, commands and reports', async ({ request }) => {
    await allureStory('Automation overview');
    await allureSeverity('normal');

    const body = await (await request.get(`${QA_API_BASE_URL}/automation`)).json();
    expect(Array.isArray(body.projects) && body.projects.length, 'projects are listed').toBeTruthy();
    expect(Array.isArray(body.agent_commands) && body.agent_commands.length, 'agent commands are listed').toBeTruthy();
    // The dashboard links these, so an empty list is a silent breakage.
    expect(body.reports, 'the report artefacts are named').toEqual(
      expect.arrayContaining(['playwright-report', 'allure-results', 'allure-report']),
    );
  });

  test('QAAPI-05 metrics are exposed in Prometheus text format', async ({ request }) => {
    await allureStory('Metrics');
    await allureSeverity('normal');

    const response = await request.get(`${QA_API_BASE_URL}/metrics`);
    expect(response.status(), '/metrics answers 200').toBe(HttpStatus.OK);

    const body = await response.text();
    // Prometheus scrapes this; without HELP/TYPE lines it is not a usable exposition.
    expect(body, '/metrics is a Prometheus exposition').toMatch(/^# HELP /m);
    expect(body, '/metrics declares metric types').toMatch(/^# TYPE /m);
  });

  test('QAAPI-06 the Scalar origin may read the OpenAPI document', async ({ request }) => {
    await allureStory('CORS for the API reference');
    await allureSeverity('critical');

    // Regression guard: the allow-list was hardcoded to :8080 while the Scalar host port
    // is overridable, so overriding SCALAR_PORT left the reference page unable to fetch
    // this document and showing only "Document could not be loaded".
    const response = await request.get(`${QA_API_BASE_URL}/openapi.json`, {
      headers: { Origin: SCALAR_ORIGIN },
    });
    expect(response.status(), 'the OpenAPI document is served').toBe(HttpStatus.OK);
    expect(
      response.headers()['access-control-allow-origin'],
      `the API reference at ${SCALAR_ORIGIN} is allowed to fetch the spec`,
    ).toBe(SCALAR_ORIGIN);
  });
});
