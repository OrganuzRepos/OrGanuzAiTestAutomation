/**
 * Full 7-stage walk-through of the property-characterization wizard for ONE concrete
 * Kiryat Motzkin address, exercised through the layered fixtures (step page objects →
 * the mid-layer `calculatorFlow` → this spec). It is the authenticated superset of the
 * non-mutating Kiryat Motzkin check in calculator-wizard-e2e.spec.ts: instead of stopping
 * at the property-confirmation step, it logs the customer in and drives the wizard all the
 * way to the roof-type step, creating a REAL project on dev.
 *
 * The wizard's progress tracker ("התקדמות השלבים") lists 7 stages ("שלב X מתוך 7"). Each
 * `test.step` below maps to a stage confirmed live via the Playwright MCP against the dev
 * app (see the organuz-product-e2e skill):
 *   1. איתור הנכס            — /calculator/address (property type + address autocomplete)
 *   2. authenticate         — the property-owner gate; the scan runs only once signed in
 *   3. select the property  — building type + the Kiryat Motzkin address (continue enables)
 *   4. property confirmation — /calculator/address/get-address ("מצאנו את הנכס המבוקש")
 *   5. satellite scan       — confirm → roof scan → /roof/<id>/marking (סימון השטח)
 *   6. auto-detected roof   — accept the AI boundary + skip obstacles → /roof/<id>/type
 *   7. roof-type step       — the created project's roof (projectId + roofId in the URL)
 * The roof-type step (stage 7 here) needs live on-map polygon drawing, so it is the
 * automation terminus — the same documented boundary as characterizeToRoofType.
 *
 * Skip policy (sanctioned — see the test-suite-parity skill): the whole journey drives the
 * LIVE address geocode and creates a project, so it is (a) LOCAL-ONLY via
 * skipGeocodeDrivingOnCi() — the geocode is geo-blocked/flaky on CI runners, the same
 * divergence as local-web — and (b) opt-in behind PRODUCT_WIZARD_E2E, since it logs a
 * customer in and creates a real dev project. It also self-skips (never fails) on a dev
 * outage or a customer OTP cooldown via skipOnOutage, so it stays green until working
 * creds exist and completes the process then.
 */
import { test, expect } from '../support/fixtures';
import { skipOnOutage, skipGeocodeDrivingOnCi } from '../support/envGate';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../../src/utils/allure';

const wizardE2eEnabled = process.env.PRODUCT_WIZARD_E2E === 'true';
// The property-type KEY (mapped to its Hebrew label inside AddressStep), not the label.
const BUILDING_TYPE = 'PROPERTY_TYPE_BUILDING';
// A concrete Kiryat Motzkin address (Hebrew DOM data constant — must match the live geocode).
const KIRYAT_MOTZKIN_ADDRESS = 'החשמונאים 22 קרית מוצקין';

test.describe('Kiryat Motzkin full customer journey', { tag: ['@product', '@wizard'] }, () => {
  // Runs at the product project's native 600x800 mobile viewport. On mobile the login CTA
  // and the user-menu name collapse behind a nameless account icon, so login + the auth
  // check go through ProductAppPage's storage-backed session signal (localStorage "user")
  // rather than the header text — see openLoginDialogIfNeeded / isLoggedIn there.

  // Login + the satellite scan + AI boundary detection are slow; widen the budget.
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async () => {
    await allureEpic('Product app');
    await allureFeature('Characterization wizard');
  });

  test('The Kiryat Motzkin address drives the wizard through to the roof-type step', async ({ calculatorFlow, page }) => {
    skipGeocodeDrivingOnCi(); // drives the live address geocode — local-only
    test.skip(!wizardE2eEnabled, 'PRODUCT_WIZARD_E2E not set — skips the login + project-creating scan on dev');
    await allureStory('Full characterization journey');
    await allureSeverity('critical');

    let ids: Awaited<ReturnType<typeof calculatorFlow.advanceAutoDetectedRoof>> | undefined;
    // A dev outage OR an unavailable customer login (OTP cooldown) becomes a skip, so this
    // completes the whole process when creds work and stays green when they don't.
    await skipOnOutage(async () => {
      await test.step('Stage 1 — open the calculator on the address step', async () => {
        await calculatorFlow.open();
        expect(await calculatorFlow.tracker.isVisible(), 'the 7-stage step tracker rendered').toBe(true);
        expect((await calculatorFlow.stages()).length, 'the tracker lists wizard stages').toBeGreaterThan(0);
      });

      await test.step('Stage 2 — authenticate as the customer (the scan runs only signed in)', async () => {
        await calculatorFlow.loginAsCustomer();
        await expect(
          calculatorFlow.address.propertyTypeButtons[BUILDING_TYPE],
          'the signed-in customer lands on the address step',
        ).toBeVisible();
      });

      await test.step('Stage 3 — choose the building type + the Kiryat Motzkin address', async () => {
        await expect(calculatorFlow.address.continueButton, 'continue is disabled before any selection').toBeDisabled();
        await calculatorFlow.address.choose(BUILDING_TYPE, KIRYAT_MOTZKIN_ADDRESS);
        await expect(
          calculatorFlow.address.continueButton,
          'continue enables once the Kiryat Motzkin address is set',
        ).toBeEnabled();
      });

      await test.step('Stage 4 — advance to the property confirmation', async () => {
        await calculatorFlow.address.continue();
        await calculatorFlow.confirm.waitFor();
        await expect(
          calculatorFlow.confirm.banner,
          'the property confirmation showed for the Kiryat Motzkin address',
        ).toBeVisible();
      });

      await test.step('Stage 5 — confirm → satellite scan → the roof-marking step', async () => {
        await calculatorFlow.confirm.confirm();
        await expect(page, 'the satellite scan routed to the roof-marking step').toHaveURL(
          /\/roof\/[^/]+\/marking/i,
          { timeout: 60_000 },
        );
      });

      await test.step('Stage 6 — accept the AI-detected boundary and skip obstacles', async () => {
        ids = await calculatorFlow.advanceAutoDetectedRoof();
      });

      await test.step('Stage 7 — arrive at the roof-type step of the created project', async () => {
        await expect(page, 'the wizard reached the roof-type step').toHaveURL(/\/roof\/[^/]+\/type/i);
        expect(ids?.projectId, 'project id parsed from the roof URL').toBeTruthy();
        expect(ids?.quotationId, 'roof id parsed from the roof URL').toBeTruthy();
      });
    });
  });
});
