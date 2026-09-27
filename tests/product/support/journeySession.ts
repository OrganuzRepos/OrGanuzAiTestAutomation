import type { BrowserContext, Page } from '@playwright/test';

// Worker-local state cannot leak across runs, environments, or concurrent invocations.
// This serial suite disables retries and consumes its own session on final sign-out.
let session: Awaited<ReturnType<BrowserContext['storageState']>> | undefined;
let tabSession: { origin: string; user: string | null } | undefined;

export function hasJourneySession(): boolean {
  return session !== undefined;
}

export function journeyStorageState(): typeof session {
  return session;
}

export async function saveJourneySession(page: Page): Promise<void> {
  session = await page.context().storageState();
  tabSession = await page.evaluate(() => {
    const browser = globalThis as unknown as {
      location: { origin: string };
      sessionStorage: { getItem(key: string): string | null };
    };
    return { origin: browser.location.origin, user: browser.sessionStorage.getItem('user') };
  });
}

export function clearJourneySession(): void {
  session = undefined;
  tabSession = undefined;
}

/** Playwright storageState omits sessionStorage; restore only this app's user entry. */
export async function restoreJourneyTabSession(context: BrowserContext): Promise<void> {
  if (!tabSession?.user) return;
  await context.addInitScript(({ origin, user }) => {
    const browser = globalThis as unknown as {
      location: { origin: string };
      sessionStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
    };
    if (browser.location.origin !== origin || !user) return;
    if (browser.sessionStorage.getItem('__qaJourneyRestored')) return;
    browser.sessionStorage.setItem('user', user);
    browser.sessionStorage.setItem('__qaJourneyRestored', 'true');
  }, tabSession);
}
