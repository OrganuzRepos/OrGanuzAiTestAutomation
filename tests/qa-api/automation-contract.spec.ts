/**
 * Contract tests for the local QA API (FastAPI).
 *
 * Two kinds of contract here:
 *
 *  1. **Self-consistency** — every response matches the shape the service's own
 *     OpenAPI document promises. A published schema nothing checks is just prose.
 *  2. **Consistency with the repository** — the automation metadata the API serves
 *     describes this repo's Playwright setup, and nothing kept the two in step. It had
 *     drifted to advertise three projects that no longer exist (`api`, `offline-demo`,
 *     `current-tests`) while omitting five that do, and the Scalar reference rendered
 *     that as fact. QAAPI-10 compares the served list against what Playwright actually
 *     discovers, so the next divergence fails instead of being published.
 *
 * Browserless. Skip-safe when the Docker stack is not running (see qaApiBlockReason);
 * anything the API answers is asserted strictly.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test, expect } from '../../src/fixtures';
import { HttpStatus } from '../../src/utils/httpStatus';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../src/utils/allure';
import { QA_API_BASE_URL, QA_API_PATHS, skipWhenQaApiIsDown } from './support/qaApi';

const REPO_ROOT = path.resolve(__dirname, '../..');

/** Field → JS typeof, for the shapes the dashboard and the Scalar reference rely on. */
const PLAYWRIGHT_PROJECT_FIELDS = ['name', 'test_match', 'command', 'purpose'] as const;
const AGENT_COMMAND_FIELDS = ['name', 'command', 'runner', 'description'] as const;

/** The projects Playwright itself discovers — the only authority on what exists. */
function discoveredProjects(): string[] {
  const raw = execFileSync('npx', ['playwright', 'test', '--list', '--reporter=json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const names = new Set<string>();
  const walk = (suite: { specs?: { tests?: { projectName?: string }[] }[]; suites?: unknown[] }): void => {
    for (const spec of suite.specs ?? []) {
      for (const single of spec.tests ?? []) if (single.projectName) names.add(single.projectName);
    }
    for (const child of (suite.suites ?? []) as typeof suite[]) walk(child);
  };
  for (const suite of JSON.parse(raw).suites ?? []) walk(suite);
  return [...names].sort();
}

test.describe('QA API contract', { tag: ['@qa-api', '@contract'] }, () => {
  test.beforeEach(async ({ request }) => {
    await allureEpic('QA dashboard API');
    await allureFeature('Contract');
    await skipWhenQaApiIsDown(request);
  });

  test('QAAPI-07 the OpenAPI document declares every endpoint the service serves', async ({ request }) => {
    await allureStory('OpenAPI completeness');
    await allureSeverity('critical');

    const response = await request.get(`${QA_API_BASE_URL}/openapi.json`);
    expect(response.status(), 'the OpenAPI document is served').toBe(HttpStatus.OK);

    const spec = await response.json();
    expect(spec.openapi, 'the document declares its OpenAPI version').toMatch(/^3\./);
    expect(spec.info?.title, 'the document is titled').toBeTruthy();

    // Every endpoint the suite exercises must be documented, or the Scalar reference
    // silently omits a route that exists.
    for (const documented of QA_API_PATHS) {
      expect(Object.keys(spec.paths ?? {}), `${documented} is documented`).toContain(documented);
    }
  });

  test('QAAPI-08 playwright-projects match their declared schema', async ({ request }) => {
    await allureStory('Response schema — projects');
    await allureSeverity('critical');

    const projects = await (await request.get(`${QA_API_BASE_URL}/automation/playwright-projects`)).json();
    expect(Array.isArray(projects), 'the endpoint returns a list').toBe(true);
    expect(projects.length, 'the list is not empty').toBeGreaterThan(0);

    for (const project of projects) {
      for (const field of PLAYWRIGHT_PROJECT_FIELDS) {
        expect(typeof project[field], `project "${project.name}" declares a string ${field}`).toBe('string');
        expect(String(project[field]).trim(), `project "${project.name}" has a non-empty ${field}`).not.toBe('');
      }
      // The command is copy-pasteable from the docs, so it must name its own project.
      expect(project.command, `the command for "${project.name}" runs that project`)
        .toContain(`--project=${project.name}`);
    }
  });

  test('QAAPI-09 qa-agent commands match their declared schema', async ({ request }) => {
    await allureStory('Response schema — agent commands');
    await allureSeverity('normal');

    const commands = await (await request.get(`${QA_API_BASE_URL}/automation/qa-agent`)).json();
    expect(Array.isArray(commands), 'the endpoint returns a list').toBe(true);
    expect(commands.length, 'the list is not empty').toBeGreaterThan(0);

    for (const command of commands) {
      for (const field of AGENT_COMMAND_FIELDS) {
        expect(typeof command[field], `command "${command.name}" declares a string ${field}`).toBe('string');
        expect(String(command[field]).trim(), `command "${command.name}" has a non-empty ${field}`).not.toBe('');
      }
    }
  });

  test('QAAPI-10 the advertised projects are the ones Playwright discovers', async ({ request }) => {
    await allureStory('Metadata matches the repository');
    await allureSeverity('critical');

    const served = (await (await request.get(`${QA_API_BASE_URL}/automation/playwright-projects`)).json())
      .map((project: { name: string }) => project.name)
      .sort();

    // The authority is the config, not this list. Drift here is published as fact
    // through the dashboard and the Scalar reference, which is how three non-existent
    // projects came to be advertised for months.
    expect(served, 'the API advertises exactly the projects Playwright registers')
      .toEqual(discoveredProjects());
  });

  test('QAAPI-11 the automation overview agrees with its own sub-resources', async ({ request }) => {
    await allureStory('Internal consistency');
    await allureSeverity('normal');

    const overview = await (await request.get(`${QA_API_BASE_URL}/automation`)).json();
    const projects = await (await request.get(`${QA_API_BASE_URL}/automation/playwright-projects`)).json();
    const commands = await (await request.get(`${QA_API_BASE_URL}/automation/qa-agent`)).json();

    // The overview is a convenience aggregate; if it can disagree with the resources it
    // aggregates, a client gets a different answer depending on which it asked.
    expect(overview.projects, 'the overview repeats the project resource verbatim').toEqual(projects);
    expect(overview.agent_commands, 'the overview repeats the command resource verbatim').toEqual(commands);
  });

  test('QAAPI-12 an unknown route is a clean JSON 404, not a crash', async ({ request }) => {
    await allureStory('Error hygiene');
    await allureSeverity('normal');

    const response = await request.get(`${QA_API_BASE_URL}/automation/does-not-exist`);
    expect(response.status(), 'an unknown route is a 404').toBe(HttpStatus.NOT_FOUND);
    expect(
      response.headers()['content-type'] ?? '',
      'the 404 is JSON, so clients can parse the error',
    ).toContain('application/json');

    const body = await response.text();
    // A stack trace here would leak the server's internals into a client response.
    expect(body, 'the error body carries no traceback').not.toMatch(/Traceback|File "\/|site-packages/);
  });
});
