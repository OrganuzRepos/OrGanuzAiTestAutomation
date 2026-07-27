import { test as base } from '../../../src/fixtures';
import { ProductFlows } from './ProductFlows';
import { RegistrationFlows } from './RegistrationFlows';
import { withTokenFixtures } from '../../../src/fixtures/token-fixtures';
import { withCalculatorStepFixtures } from './step-fixtures';
import { withCalculatorFlowFixtures } from './flow-fixtures';
import { withAuthFixtures } from './auth-fixtures';
import { withProductPageFixtures } from './product-page-fixtures';
import { authFile, hasSavedSession } from './auth';
import type { ProductPersonaId } from '../matrix/e2e-matrix.data';

// Re-export the token-fixture types so specs can import them from the domain fixture.
export type { ProductTokenSetup, ProductAuthTokenSetup } from '../../../src/types/token.types';
// Re-export the calculator page-object + flow fixture types (stepTracker/addressStep/
// propertyConfirm/calculatorFlow) and the cellular-login fixture type so specs can type
// them from the domain fixture.
export type { CalculatorStepFixtures } from './step-fixtures';
export type { CalculatorFlowFixtures } from './flow-fixtures';
export type { AuthFixtures } from './auth-fixtures';
export type { ProductPageFixtures } from './product-page-fixtures';

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
const productBase = base.extend<{
  authRole?: ProductPersonaId;
}>({
  authRole: [undefined, { option: true }],

  storageState: async ({ authRole }, use) => {
    await use(authRole && hasSavedSession(authRole) ? authFile(authRole) : undefined);
  },

});

// Page fixture dependency graph: LoginDialog → focused product sub-pages → ProductAppPage.
const productPageTest = withProductPageFixtures(withAuthFixtures(productBase));

// High-level flows consume the fixture-built ProductAppPage; no page object is constructed
// from inside a flow.
const productTest = productPageTest.extend<{
  product: ProductFlows;
  registration: RegistrationFlows;
}>({
  product: async ({ page, productApp }, use) => {
    await use(new ProductFlows(page, productApp));
  },
  registration: async ({ page, product }, use) => {
    await use(new RegistrationFlows(page, product));
  },
});

// Layer the remaining fixtures: calculator step pages → calculator flow → token extractors.
// Every product test can request either a narrow page fixture or the compatibility facade.
export const test = withTokenFixtures(
  withCalculatorFlowFixtures(withCalculatorStepFixtures(productTest)),
);

export { expect } from '@playwright/test';
