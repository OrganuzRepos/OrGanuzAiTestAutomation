/**
 * End-to-end UI coverage of the CUSTOMER calculator process, exercised through the layered
 * fixtures: step page objects (stepTracker / addressStep / propertyConfirm) → the mid-layer
 * `calculatorFlow` → these specs.
 *
 * Confirmed live boundary (see the organuz-product-e2e skill): the public wizard runs
 * step 1 (property type + address) → step 2 (property confirmation), and confirming pops
 * the "הרשמת בעלי נכסים" auth gate — the satellite scan that creates the project runs only
 * once the customer is authenticated.
 *
 * Skip policy (sanctioned — see the test-suite-parity skill):
 *  - check 1 (step tracker) is deterministic and always runs when the dev app is up;
 *  - checks 2–4 drive the LIVE address geocode, which is geo-blocked/flaky on CI runners,
 *    so they are LOCAL-ONLY via skipGeocodeDrivingOnCi() — the same divergence as local-web;
 *  - check 5 drives the full authenticated journey and is opt-in (PRODUCT_WIZARD_E2E) and
 *    local-only; it also self-skips if customer login is unavailable (dev OTP cooldown), so
 *    it stays green until working customer creds exist and completes the process then.
 */
import { test, expect } from '../support/fixtures';
import { skipOnOutage, skipGeocodeDrivingOnCi } from '../support/envGate';
import { MAIN_PROPERTY_CHARACTERIZATION } from '../matrix/e2e-matrix.data';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../../src/utils/allure';

const wizardE2eEnabled = process.env.PRODUCT_WIZARD_E2E === 'true';
const scenario = MAIN_PROPERTY_CHARACTERIZATION;
// The property-type KEY (mapped to its Hebrew label inside AddressStep), not the label itself.
const PRIVATE_HOUSE_TYPE = scenario.propertyType;

test.describe('Customer calculator process', { tag: ['@product', '@wizard'] }, () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async () => {
    await allureEpic('Product app');
    await allureFeature('Customer characterization process');
  });

  // --- Public, non-mutating: step 1 → step 2 → the auth boundary -----------

  test('The wizard tracker lists the characterization stages', async ({ calculatorFlow }) => {
    await allureStory('Step tracker');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    expect(await calculatorFlow.tracker.isVisible(), 'the step tracker rendered').toBe(true);
    expect((await calculatorFlow.stages()).length, 'the tracker lists wizard stages').toBeGreaterThan(0);
  });

  test('Step 1 continue is gated until a property type and address are chosen', async ({ calculatorFlow }) => {
    skipGeocodeDrivingOnCi(); // types an address + waits for the live suggestion — local-only
    await allureStory('Step 1 gating');
    await allureSeverity('normal');
    await skipOnOutage(() => calculatorFlow.open());

    await expect(calculatorFlow.address.continueButton(), 'continue is disabled before any selection').toBeDisabled();
    await calculatorFlow.address.choose(PRIVATE_HOUSE_TYPE, scenario.address);
    await expect(calculatorFlow.address.continueButton(), 'continue enables once type + address are set').toBeEnabled();
  });

  test('Locating a property advances to the confirmation step', async ({ calculatorFlow }) => {
    skipGeocodeDrivingOnCi(); // drives the live address autocomplete — local-only
    await allureStory('Property confirmation');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    await calculatorFlow.locateProperty(PRIVATE_HOUSE_TYPE, scenario.address);
    await expect(calculatorFlow.confirm.banner(), 'the "we found the property" confirmation showed').toBeVisible();
    await expect(calculatorFlow.confirm.confirmButton()).toBeVisible();
  });

  test('Confirming the property requires the customer to authenticate', async ({ calculatorFlow }) => {
    skipGeocodeDrivingOnCi(); // drives the live address autocomplete — local-only
    await allureStory('Auth boundary');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    await calculatorFlow.locateProperty(PRIVATE_HOUSE_TYPE, scenario.address);
    expect(
      await calculatorFlow.confirmExpectingAuthGate(),
      'a signed-out visitor is prompted to authenticate before the scan',
    ).toBe(true);
  });

  // --- Authenticated: the full customer journey (opt-in, skip-safe) --------

  test('An authenticated customer characterizes the property to a roof', async ({ calculatorFlow, page }) => {
    skipGeocodeDrivingOnCi(); // also drives the live geocode during characterization — local-only
    test.skip(!wizardE2eEnabled, 'PRODUCT_WIZARD_E2E not set — skips the login + project-creating scan on dev');
    await allureStory('Authenticated characterization');
    await allureSeverity('critical');

    let ids: Awaited<ReturnType<typeof calculatorFlow.characterizeAsCustomer>> | undefined;
    // Turns a dev outage OR an unavailable customer login (OTP cooldown) into a skip, so
    // this completes the full process when creds work and stays green when they don't.
    await skipOnOutage(async () => {
      ids = await calculatorFlow.characterizeAsCustomer(scenario);
    });

    await expect(page).toHaveURL(/\/roof\/[^/]+\/type/i);
    expect(ids?.projectId, 'project id parsed from the roof URL').toBeTruthy();
    expect(ids?.quotationId, 'roof id parsed from the roof URL').toBeTruthy();
  });
});
