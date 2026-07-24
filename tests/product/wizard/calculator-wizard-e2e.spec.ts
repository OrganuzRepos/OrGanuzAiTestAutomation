/**
 * End-to-end coverage of the public property-characterization wizard on the dev
 * calculator (the multi-step "התקדמות השלבים" flow — see the organuz-product-e2e skill).
 *
 * These three checks are NON-mutating: they drive step 1 only (property type + address
 * autocomplete) and never trigger the satellite scan, so no project is created. The first
 * two are deterministic and always run when the dev app is up (skipOnOutage); the third
 * drives the LIVE address geocode, which is geo-blocked/flaky on CI runners, so it is
 * LOCAL-ONLY via skipGeocodeDrivingOnCi() — a sanctioned CI divergence, like local-web.
 *
 * The authenticated portion (scan → roof → results) requires customer login before the
 * scan and is covered by customer-process-e2e.spec.ts via the layered calculatorFlow.
 */
import { test, expect } from '../support/fixtures';
import { skipOnOutage, skipGeocodeDrivingOnCi } from '../support/envGate';
import { MAIN_PROPERTY_CHARACTERIZATION, PROPERTY_TYPE_LABELS } from '../matrix/e2e-matrix.data';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../../src/utils/allure';

const scenario = MAIN_PROPERTY_CHARACTERIZATION;
// The Hebrew property-type LABEL (getByRole name), distinct from the type KEY used elsewhere.
const PRIVATE_HOUSE_LABEL = PROPERTY_TYPE_LABELS.PROPERTY_TYPE_PRIVATE_HOUSE;

test.describe('Calculator characterization wizard', { tag: ['@product', '@wizard'] }, () => {
  // The satellite scan + AI boundary detection are slow; widen the per-test budget.
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async () => {
    await allureEpic('Product app');
    await allureFeature('Characterization wizard');
  });

  // --- Step 1: non-mutating (no project is created) ------------------------

  test('Step 1 renders the property-type buttons and the step tracker', async ({ product, page }) => {
    await allureStory('Step tracker');
    await allureSeverity('critical');
    await skipOnOutage(() => product.openCalculator());

    await expect(page.getByRole('list', { name: 'התקדמות השלבים' })).toBeVisible();
    await expect(page.getByRole('button', { name: PRIVATE_HOUSE_LABEL })).toBeVisible();
  });

  test('The continue button is gated until a property type and address are chosen', async ({ product, page }) => {
    await allureStory('Step 1 gating');
    await allureSeverity('normal');
    await skipOnOutage(() => product.openCalculator());

    const cont = page.getByRole('button', { name: 'בוא נמשיך' }).last();
    await expect(cont).toBeVisible();
    await expect(cont, 'continue is disabled before any selection').toBeDisabled();
  });

  test('Choosing a property type and address suggestion enables step 1', async ({ product, page }) => {
    skipGeocodeDrivingOnCi(); // drives the live address autocomplete — local-only
    await allureStory('Address autocomplete');
    await allureSeverity('normal');
    await skipOnOutage(() => product.openCalculator());

    await page.getByRole('button', { name: PRIVATE_HOUSE_LABEL }).click();
    const address = page.getByRole('combobox').first();
    await address.click();
    // pressSequentially so the address autocomplete fires its key handlers (see the skill).
    await address.pressSequentially(scenario.address, { delay: 60 });
    await page.getByRole('option').first().waitFor({ state: 'visible', timeout: 20_000 });
    await page.getByRole('option').first().click();

    await expect(
      page.getByRole('button', { name: 'בוא נמשיך' }).last(),
      'continue is enabled once type + address are set',
    ).toBeEnabled();
  });

  // The authenticated portion (satellite scan → roof → results) requires customer login
  // BEFORE the scan (confirmed live: confirming the property pops the auth gate). It is
  // covered by customer-process-e2e.spec.ts via the layered calculatorFlow, so it is not
  // duplicated here.
});
