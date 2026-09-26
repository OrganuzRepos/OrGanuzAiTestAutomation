/**
 * End-to-end coverage of the public property-characterization wizard on the dev
 * calculator (the multi-step "התקדמות השלבים" flow — see the organuz-product-e2e skill),
 * exercised through the layered fixtures: step page objects (stepTracker / addressStep)
 * → the mid-layer `calculatorFlow` → these specs. No raw locators live here — selectors
 * are owned by the step page objects (src/pages/product/*).
 *
 * These checks are NON-mutating: they drive step 1 (property type + address autocomplete)
 * and — for the last check — advance into the step-2 property confirmation, but never
 * click confirm, so no satellite scan runs and no project is created. The first two are
 * deterministic and always run when the dev app is up (skipOnOutage); the last two drive
 * the LIVE address geocode, which is geo-blocked/flaky on CI runners, so they are
 * LOCAL-ONLY via skipGeocodeDrivingOnCi() — a sanctioned CI divergence, like local-web.
 *
 * The authenticated portion (scan → roof → results) requires customer login before the
 * scan and is covered by customer-process-e2e.spec.ts via the layered calculatorFlow.
 */
import { test, expect } from '../support/fixtures';
import { skipOnOutage, skipGeocodeDrivingOnCi } from '../support/envGate';
import { MAIN_PROPERTY_CHARACTERIZATION } from '../matrix/e2e-matrix.data';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../../src/utils/allure';

const scenario = MAIN_PROPERTY_CHARACTERIZATION;
// The property-type KEY (mapped to its Hebrew label inside AddressStep), not the label itself.
const PRIVATE_HOUSE_TYPE = scenario.propertyType;
// A concrete Kiryat Motzkin address (Hebrew DOM data constant — must match the live geocode).
const KIRYAT_MOTZKIN_ADDRESS = 'החשמונאים 22 קרית מוצקין';

test.describe('Calculator characterization wizard', { tag: ['@product', '@wizard'] }, () => {
  // The satellite scan + AI boundary detection are slow; widen the per-test budget.
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async () => {
    await allureEpic('Product app');
    await allureFeature('Characterization wizard');
  });

  // --- Step 1: non-mutating (no project is created) ------------------------

  test('Step 1 renders the property-type buttons and the step tracker', async ({ calculatorFlow }) => {
    await allureStory('Step tracker');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    expect(await calculatorFlow.tracker.isVisible(), 'the step tracker rendered').toBe(true);
    await expect(calculatorFlow.address.propertyTypeButtons[PRIVATE_HOUSE_TYPE]).toBeVisible();
  });

  test('The continue button is gated until a property type and address are chosen', async ({ calculatorFlow }) => {
    await allureStory('Step 1 gating');
    await allureSeverity('normal');
    await skipOnOutage(() => calculatorFlow.open());

    await expect(
      calculatorFlow.address.continueButton,
      'continue is disabled before any selection',
    ).toBeDisabled();
  });

  test('Choosing a property type and address suggestion enables step 1', async ({ calculatorFlow }) => {
    skipGeocodeDrivingOnCi(); // drives the live address autocomplete — local-only
    await allureStory('Address autocomplete');
    await allureSeverity('normal');
    await skipOnOutage(() => calculatorFlow.open());

    await calculatorFlow.address.choose(PRIVATE_HOUSE_TYPE, scenario.address);

    await expect(
      calculatorFlow.address.continueButton,
      'continue is enabled once type + address are set',
    ).toBeEnabled();
  });

  test('A specific Kiryat Motzkin address advances to the property-confirmation step', async ({ calculatorFlow }) => {
    skipGeocodeDrivingOnCi(); // drives the live address geocode + confirmation — local-only
    await allureStory('Property confirmation');
    await allureSeverity('normal');
    await skipOnOutage(() => calculatorFlow.open());

    // Step 1: choose the property type + the Kiryat Motzkin address, then continue.
    await expect(calculatorFlow.address.continueButton, 'continue is disabled before any selection').toBeDisabled();
    await calculatorFlow.address.choose('PROPERTY_TYPE_BUILDING', KIRYAT_MOTZKIN_ADDRESS);
    await expect(
      calculatorFlow.address.continueButton,
      'continue is enabled once the Kiryat Motzkin address is set',
    ).toBeEnabled();

    // Step 2: continue advances to the auto-located property confirmation ("מצאנו את הנכס המבוקש").
    await calculatorFlow.address.continue();
    await calculatorFlow.confirm.waitFor();
    await expect(
      calculatorFlow.confirm.banner,
      'the property confirmation showed for the Kiryat Motzkin address',
    ).toBeVisible();
    await expect(calculatorFlow.confirm.confirmButton).toBeVisible();
  });

  // The authenticated portion (satellite scan → roof → results) requires customer login
  // BEFORE the scan (confirmed live: confirming the property pops the auth gate). It is
  // covered by customer-process-e2e.spec.ts via the layered calculatorFlow, so it is not
  // duplicated here.
});
