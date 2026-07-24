import { test as base } from '../../../src/fixtures';
import { ProductFlows } from './ProductFlows';
import { RegistrationFlows } from './RegistrationFlows';
import { withTokenFixtures } from '../../../src/fixtures/token-fixtures';
import { withCalculatorStepFixtures } from './step-fixtures';
import { withCalculatorFlowFixtures } from './flow-fixtures';
import { authFile, hasSavedSession } from './auth';
import type { ProductPersonaId } from '../matrix/e2e-matrix.data';

// Re-export the token-fixture types so specs can import them from the domain fixture.
export type { ProductTokenSetup, ProductAuthTokenSetup } from '../../../src/types/token.types';
// Re-export the calculator page-object + flow fixture types (stepTracker/addressStep/
// propertyConfirm/calculatorFlow) so specs can type them from the domain fixture.
export type { CalculatorStepFixtures } from './step-fixtures';
export type { CalculatorFlowFixtures } from './flow-fixtures';

/**
 * Product-app test fixture: exposes `product` (high-level ProductFlows) on top of
 * the shared fixtures (Allure attachments + failure capture). Import `test`/`expect`
 * from here in tests/product specs to keep them short.
 *
 * `authRole` is an option: set it (via `test.use({ authRole: '<persona>' })`) and the
 * test starts from that role's saved storageState (written once by the product-setup
 * project — see auth.setup.ts), so per-role specs resume the session instead of each
 * logging in and tripping the dev OTP rate-limit. If the saved session is missing
 * (setup skipped on cooldown), storageState falls back to unauthenticated and the
 * spec's `product.resumeSession()` skips with a clear reason.
 *
 * The token-extractor setup fixtures (`productToken`, `productAuthToken`) are layered
 * on via withTokenFixtures — see token-fixtures.ts.
 */
const productTest = base.extend<{
  product: ProductFlows;
  registration: RegistrationFlows;
  authRole?: ProductPersonaId;
}>({
  authRole: [undefined, { option: true }],

  storageState: async ({ authRole }, use) => {
    await use(authRole && hasSavedSession(authRole) ? authFile(authRole) : undefined);
  },

  product: async ({ page }, use) => {
    await use(new ProductFlows(page));
  },

  registration: async ({ page }, use) => {
    await use(new RegistrationFlows(page));
  },
});

// Layer the fixtures: step page objects (pages) → calculator flow (mid-layer, depends on
// the pages + `product`) → token extractors. So every product test gets stepTracker/
// addressStep/propertyConfirm (pages), calculatorFlow (flow), and the token fixtures.
export const test = withTokenFixtures(
  withCalculatorFlowFixtures(withCalculatorStepFixtures(productTest)),
);

export { expect } from '@playwright/test';
