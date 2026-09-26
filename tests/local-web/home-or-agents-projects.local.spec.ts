import { test, expect, localOnly } from './support';
import { AgentNames } from '../constants';

localOnly();

test.describe('Local-only: Or, agents & projects', { tag: ['@ui', '@local-only'] }, () => {
  test.beforeEach(async ({ home }) => {
    await home.open();
  });

  test('"Meet Or" section heading is visible', async ({ home }) => {
    await expect(home.or.heading).toBeVisible();
  });

  test('"Talk to Or" link is visible', async ({ home }) => {
    await expect(home.or.talkToOrLink).toBeVisible();
  });

  test('agents section heading is visible', async ({ home }) => {
    await expect(home.agents.heading).toBeVisible();
  });

  for (const name of AgentNames) {
    test(`agent card "${name}" is visible`, async ({ home }) => {
      await expect(home.agents.agents[name]).toBeVisible();
    });
  }

  test('active-projects section heading is visible', async ({ home }) => {
    await expect(home.projects.heading).toBeVisible();
  });
});
