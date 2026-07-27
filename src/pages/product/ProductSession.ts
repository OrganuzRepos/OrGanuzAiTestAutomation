import type { Page } from '@playwright/test';

/** Self-contained because Playwright serializes this function into the browser. */
function browserHasPersistedToken(): boolean {
  try {
    const browserGlobal = globalThis as unknown as {
      localStorage: { getItem(key: string): string | null };
    };
    const raw = browserGlobal.localStorage.getItem('user');
    return Boolean(raw && JSON.parse(raw)?.data?.token);
  } catch {
    return false;
  }
}

/**
 * Layout-independent authentication-session signal for the product SPA.
 *
 * The predicate executes in the browser context, so the Node-only TypeScript
 * configuration does not need to expose DOM globals.
 */
export class ProductSession {
  constructor(private readonly page: Page) {}

  /** Read the current persisted session without waiting. */
  async hasPersistedToken(): Promise<boolean> {
    return this.page.evaluate(browserHasPersistedToken).catch(() => false);
  }

  /** Wait up to `timeoutMs` for the login XHR to persist a session token. */
  async waitForPersistedToken(timeoutMs: number): Promise<boolean> {
    return this.page
      .waitForFunction(browserHasPersistedToken, undefined, { timeout: timeoutMs })
      .then(() => true)
      .catch(() => false);
  }
}
