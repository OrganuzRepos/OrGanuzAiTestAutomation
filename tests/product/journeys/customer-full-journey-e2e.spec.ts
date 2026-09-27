/**
 * Five full end-to-end CUSTOMER journeys through the product web UI, each starting from a
 * signed-in customer and completing one whole thing the customer actually does:
 *
 *   1. sign in and characterize a property → a real saved project
 *   2. find that project in the personal area and reopen it into the wizard
 *   3. be refused by the roof-type step until a roof is marked (the wizard's guard)
 *   4. walk back to an earlier stage through the progress tracker
 *   5. navigate to the personal area and sign out
 *
 * SERIAL by design. The dev app rate-limits OTP sends per phone, so journey 1 performs the
 * one real login and saves its storageState (journeySession.ts); journeys 2–4 resume it,
 * and journey 5 takes a clean context so signing out cannot invalidate a session another
 * journey is still using.
 *
 * Journeys 3 and 4 each drive their OWN characterization instead of resuming journey 1's.
 * That is not waste: confirmed live, the roof-type guard and the tracker's "חזרה לשלב"
 * buttons exist only on the scan-fresh path — a deep link or a reopened project lands on a
 * view-only step (see CalculatorFlow.characterizeToRoofTypeAsCustomer). So a run creates
 * three real dev projects, which is part of why these are opt-in.
 *
 * Skip policy (sanctioned — see the test-suite-parity skill). These are the same gates the
 * existing wizard e2e uses, so the default suite stays all-green:
 *  - LOCAL-ONLY via skipGeocodeDrivingOnCi(): journey 1 drives the live govmap geocode,
 *    which is geo-blocked/flaky for CI runners — the same divergence as local-web;
 *  - opt-in behind PRODUCT_WIZARD_E2E: these log a customer in and create a real dev
 *    project, so they stay dormant unless a developer asks for them;
 *  - self-skipping on a dev outage / OTP cooldown via skipOnOutage.
 * Everything past those gates is a real assertion: a wizard that stops creating projects,
 * a personal area that loses them, or a roof-type step that stops guarding is a failure.
 *
 * The Hebrew here is DOM/data only (addresses, stage labels) — the report layer is English,
 * per the organuz-hebrew-tests skill.
 */
import { test, expect } from '../support/journey-fixtures';
import { skipOnOutage, skipGeocodeDrivingOnCi } from '../support/envGate';
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
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test.beforeEach(async () => {
    skipGeocodeDrivingOnCi();
    test.skip(!wizardE2eEnabled, 'PRODUCT_WIZARD_E2E not set — these log in and create a real dev project');
    await allureEpic('Product app');
    await allureFeature('Customer full journey');
  });

  // Every run starts from one fresh login: drop the run-scoped session on the way out so
  // a later run never resumes an expired one.
  test.afterAll(() => clearJourneySession());

  // --- Journey 1: sign in → characterize → a saved project ------------------

  test('signs in and characterizes a property into a saved project', async ({ calculatorFlow, page }) => {
    await allureStory('Sign in and characterize');
    await allureSeverity('critical');

    await skipOnOutage(async () => {
      createdProject = await calculatorFlow.characterizeAsCustomer(scenario);
    });
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
    test.skip(!hasJourneySession(), 'journey 1 did not sign a customer in');

    await skipOnOutage(() => calculatorFlow.open());
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
    test.skip(!hasJourneySession(), 'journey 1 did not sign a customer in');

    await skipOnOutage(async () => {
      await calculatorFlow.characterizeToRoofTypeAsCustomer(scenario);
    });

    expect(await calculatorFlow.expectRoofTypeGuard(), 'the wizard refused to advance').toBe(true);
    await expect(page, 'the wizard stayed on the roof-type step').toHaveURL(/\/roof\/[^/]+\/type/i);
  });

  // --- Journey 4: walk back through the progress tracker --------------------

  test('walks back to the property step through the progress tracker', async ({ calculatorFlow, page }) => {
    await allureStory('Tracker back-navigation');
    await allureSeverity('normal');
    test.skip(!hasJourneySession(), 'journey 1 did not sign a customer in');

    await skipOnOutage(async () => {
      await calculatorFlow.characterizeToRoofTypeAsCustomer(scenario);
    });

    // A completed stage becomes a "חזרה לשלב …" button — the only in-app way back.
    await calculatorFlow.goBackToStage(WIZARD.stages[0]);

    await expect(page, 'the wizard returned to the property step').toHaveURL(/\/calculator\/address/i);
    expect(await calculatorFlow.tracker.isVisible(), 'the tracker survived the walk back').toBe(true);
  });

  // --- Journey 5: navigate the personal area and sign out -------------------

  test.describe('and then signs out', () => {
    // A clean context: signing out invalidates this session, so it must not be the one
    // journeys 2–4 resume (the same isolation role-logout.spec.ts uses). Opting out is an
    // option of its own because the journey fixture shadows `storageState` — see
    // journey-fixtures.ts.
    test.use({ useJourneySession: false });

    test('navigates the personal area and signs out', async ({ product, calculatorFlow, page }) => {
      await allureStory('Personal area navigation and sign-out');
      await allureSeverity('critical');

      await skipOnOutage(() => calculatorFlow.open());
      await skipOnOutage(() => calculatorFlow.loginAsCustomer());
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
