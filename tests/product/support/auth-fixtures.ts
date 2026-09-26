import { TestType, Fixtures, PlaywrightTestArgs } from '@playwright/test';
import { LoginDialog } from '../../../src/pages/product';

/**
 * Cellular-login fixture. Exposes the LoginDialog page object as a lazy `loginDialog`
 * fixture on every product test, composed via `withAuthFixtures(baseTest)` in fixtures.ts
 * — the same pattern as withCalculatorStepFixtures. Lazy: built only when a test requests it.
 */
export interface AuthFixtures {
  /** The cellular (phone + OTP) login dialog page object. */
  loginDialog: LoginDialog;
}

const authFixtureImpl: Fixtures<AuthFixtures, object, PlaywrightTestArgs, object> = {
  loginDialog: async ({ page }, use) => {
    await use(new LoginDialog(page));
  },
};

/** Extend a base test with the `loginDialog` cellular-login page object. */
export function withAuthFixtures<
  TArgs extends PlaywrightTestArgs,
  TWorker extends object,
>(baseTest: TestType<TArgs, TWorker>): TestType<TArgs & AuthFixtures, TWorker> {
  return baseTest.extend<AuthFixtures>(
    authFixtureImpl as Fixtures<AuthFixtures, object, TArgs, TWorker>,
  );
}
