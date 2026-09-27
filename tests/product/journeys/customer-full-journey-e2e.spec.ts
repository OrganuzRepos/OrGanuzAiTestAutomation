/**
 * Five local, opt-in customer journeys. One login is shared across fresh contexts;
 * the last journey signs out. No retries or OTP resends: a failed prerequisite fails
 * the serial suite instead of disguising unverified coverage as an outage skip.
 * Journeys 1, 3, and 4 create real projects to exercise fresh scan wizard state.
 */
import { test, expect } from '../support/journey-fixtures';
import { skipGeocodeDrivingOnCi } from '../support/envGate';
import {
  clearJourneySession,
  hasJourneySession,
  saveJourneySession,
} from '../support/journeySession';
import { MAIN_PROPERTY_CHARACTERIZATION } from '../matrix/e2e-matrix.data';
import { PropertyCharacterizationBuilder } from '../matrix/property-characterization.builder';
import { PERSONAL_AREA, WIZARD } from '../../../src/pages/product';
import type { ProductRuntimeIds } from '../support/ProductAppPage';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../../src/utils/allure';

const wizardE2eEnabled = process.env.PRODUCT_WIZARD_E2E === 'true';

// A concrete Kiryat Motzkin address (Hebrew DOM data constant — must match the live
// geocode) on the canonical private-house characterization.
const JOURNEY_ADDRESS = 'החשמונאים 22 קרית מוצקין';
const scenario = PropertyCharacterizationBuilder.from(MAIN_PROPERTY_CHARACTERIZATION)
  .atAddress(JOURNEY_ADDRESS)
  .build();

// The project journey 1 creates, handed to the journeys that follow (serial file).
let createdProject: ProductRuntimeIds = {};

test.describe('Customer full journeys', { tag: ['@product', '@journey', '@e2e'] }, () => {
  // Serial: journey 1 owns the login + the project every later journey works on.
  test.describe.configure({ mode: 'serial', timeout: 240_000, retries: 0 });

  test.beforeEach(async ({ calculatorFlow, product }) => {
    skipGeocodeDrivingOnCi();
    test.skip(!wizardE2eEnabled, 'PRODUCT_WIZARD_E2E not set — these log in and create a real dev project');
    await allureEpic('Product app');
    await allureFeature('Customer full journey');
    if (hasJourneySession()) {
      await calculatorFlow.open();
      expect(await product.app.isAuthenticated(), 'the shared customer session is still valid').toBe(true);
    }
  });

  // Release worker-local state after the suite, including failed runs.
  test.afterAll(() => clearJourneySession());

  // --- Journey 1: sign in → characterize → a saved project ------------------

  test('signs in and characterizes a property into a saved project', async ({ calculatorFlow, page }) => {
    await allureStory('Sign in and characterize');
    await allureSeverity('critical');

    createdProject = await calculatorFlow.characterizeAsCustomer(scenario);
    await saveJourneySession(page);

    expect(createdProject.projectId, 'the wizard created a project').toBeTruthy();
    expect(createdProject.quotationId, 'the satellite scan produced a roof').toBeTruthy();
    await expect(page, 'the journey ends on the roof-type step').toHaveURL(/\/roof\/[^/]+\/type/i);
    await expect(calculatorFlow.roofType.heading, 'the roof-type step rendered').toBeVisible();

    // The tracker has revealed every stage the customer walked through, in order.
    const walked = WIZARD.stages.slice(0, 2);
    expect(await calculatorFlow.revealedStages(), 'the tracker names the walked stages')
      .toEqual(expect.arrayContaining(walked));
  });

  // --- Journey 2: personal area → reopen the saved project ------------------

  test('finds the saved project in the personal area and reopens it', async ({ calculatorFlow, product, page }) => {
    await allureStory('Personal area and resume');
    await allureSeverity('critical');
    expect(hasJourneySession(), 'journey 1 established the session').toBe(true);

    await calculatorFlow.open();
    await product.openPersonalArea();

    await expect(calculatorFlow.offers.heading, 'the personal area landed').toBeVisible();
    await expect(calculatorFlow.offers.sortControl, 'the offers list rendered').toBeVisible();
    await expect(calculatorFlow.offers.offerCards, 'the customer has saved offers')
      .not.toHaveCount(0);
    await expect(calculatorFlow.offers.offerFor('קריית מוצקין'), 'the new project is listed')
      .toBeVisible();

    // Reopening must return to the SAME project, not start a new characterization.
    await calculatorFlow.offers.openFirstProject();
    const reopened = page.url();
    expect(reopened, 'reopening lands back in the calculator').toMatch(/\/calculator\//i);
    // The roof id is the real discriminator — the leading URL segment is the user's arena,
    // which is constant for the account.
    if (createdProject.quotationId) {
      expect(reopened, 'reopening returns to the characterization journey 1 created')
        .toContain(createdProject.quotationId);
    }
  });

  // --- Journey 3: the roof-type step refuses to advance unmarked ------------

  test('is refused by the roof-type step until a roof is marked', async ({ calculatorFlow, page }) => {
    await allureStory('Roof-type guard');
    await allureSeverity('normal');
    expect(hasJourneySession(), 'journey 1 established the session').toBe(true);

    await calculatorFlow.characterizeToRoofTypeAsCustomer(scenario);

    expect(await calculatorFlow.expectRoofTypeGuard(), 'the wizard refused to advance').toBe(true);
    await expect(page, 'the wizard stayed on the roof-type step').toHaveURL(/\/roof\/[^/]+\/type/i);
  });

  // --- Journey 4: walk back through the progress tracker --------------------

  test('walks back to the property step through the progress tracker', async ({ calculatorFlow, page }) => {
    await allureStory('Tracker back-navigation');
    await allureSeverity('normal');
    expect(hasJourneySession(), 'journey 1 established the session').toBe(true);

    await calculatorFlow.characterizeToRoofTypeAsCustomer(scenario);

    // A completed stage becomes a "חזרה לשלב …" button — the only in-app way back.
    await calculatorFlow.goBackToStage(WIZARD.stages[0]);

    await expect(page, 'the wizard returned to the property step').toHaveURL(/\/calculator\/address/i);
    expect(await calculatorFlow.tracker.isVisible(), 'the tracker survived the walk back').toBe(true);
  });

  // --- Journey 5: navigate the personal area and sign out -------------------

  test.describe('and then signs out', () => {
    // Runs last and consumes the session established by journey 1.
    test('navigates the personal area and signs out', async ({ product, calculatorFlow, page }) => {
      await allureStory('Personal area navigation and sign-out');
      await allureSeverity('critical');

      await calculatorFlow.open();
      expect(hasJourneySession(), 'journey 1 established the session').toBe(true);
      expect(await product.app.isAuthenticated(), 'the customer signed in').toBe(true);

      await product.openPersonalArea();
      await expect(page, 'the personal area is its own route').toHaveURL(PERSONAL_AREA.path);
      await expect(calculatorFlow.offers.heading, 'the personal area landed').toBeVisible();
      await expect(calculatorFlow.offers.sortControl, 'the offers list rendered').toBeVisible();

      await product.logout();
      await product.expectLoggedOut();
      // The header collapses to a nameless icon at this viewport, so the login CTA alone
      // is not proof of a signed-out app — check the persisted session directly.
      expect(await product.app.isAuthenticated(), 'the session was destroyed').toBe(false);
    });
  });
});
