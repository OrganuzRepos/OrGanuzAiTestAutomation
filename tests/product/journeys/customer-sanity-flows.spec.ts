/**
 * Ten CI-SAFE client (customer) sanity flows through the product calculator.
 *
 * Companion to `customer-full-journey-e2e.spec.ts`, which drives the deep authenticated
 * journeys. Those are opt-in and local-only (they need an OTP, create real dev projects
 * and drive the live geocode), so in a default run they never execute. These ten cover
 * the client-facing paths that can be exercised *deterministically*, so they run on every
 * push and actually protect the product:
 *
 *   - no login, so no OTP and no per-phone rate limit;
 *   - no address autocomplete, so no dependency on the govmap geocode that forces the
 *     wizard specs local-only (see skipGeocodeDrivingOnCi);
 *   - no project creation, so a run leaves nothing behind on dev.
 *
 * Every behaviour asserted here was confirmed live on dev (2026-09-28) at the product
 * project's own 600x800 viewport, which matters: several client affordances simply do not
 * exist at that width. The language control has no rendered button there at all, so a
 * language round-trip is deliberately NOT part of this file — `tests/product/en/**` owns
 * that. Sign-in state is likewise asserted through the persisted-session signal rather
 * than header text, because the header collapses to a nameless icon (see ProductSession).
 *
 * The only gate is skipOnOutage() around opening the app, the same policy as
 * customer-process-e2e's deterministic checks.
 */
import { test, expect } from '../support/fixtures';
import { skipOnOutage } from '../support/envGate';
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS } from '../../../src/data/productMatrix.constants';
import { WIZARD } from '../../../src/pages/product';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../../src/utils/allure';

/** A project/roof pair that exists on dev — used only to prove the step is auth-gated. */
const GATED_ARENA_ID = '68cfc16bd12bc627790f2f99';
const GATED_ROOF_ID = '6ab9900291435ec9e80972bd';

/** The signed-in personal area; a visitor must not reach it. */
const PERSONAL_AREA_PATH = '/pricing/my-offers';

/** Solara's coaching bubble on the property step, and its dismiss control. */
const AGENT_BUBBLE = /סולרה אומרת/;
const AGENT_BUBBLE_CLOSE = /סגור הודעת סוכן/;

/**
 * Hands the whole characterization to Organuz's agents and creates a REAL lead, so it is
 * asserted present and never clicked. See the organuz-product-e2e skill.
 */
const AGENT_HANDOFF_CTA = /הזמן דוח סולארי עכשיו/;

test.describe('Client sanity flows', { tag: ['@product', '@sanity', '@client'] }, () => {
  test.beforeEach(async () => {
    await allureEpic('Product app');
    await allureFeature('Client sanity flows');
  });

  // --- Landing -------------------------------------------------------------

  test('A visitor lands on the property step at stage 1 of the wizard', async ({ calculatorFlow, product, page }) => {
    await allureStory('Entry');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    await expect(page, 'the app opens on the property step').toHaveURL(/\/calculator\/address/i);
    expect(await calculatorFlow.tracker.isVisible(), 'the wizard progress is shown').toBe(true);
    expect(await product.app.isAuthenticated(), 'a fresh visitor is signed out').toBe(false);

    // Desktop lists the stage names; this viewport renders "שלב 1 מתוך 7" instead.
    const progress = (await calculatorFlow.revealedStages()).join(' ');
    expect(progress, 'the wizard starts at stage 1 of its 7 stages')
      .toMatch(new RegExp(`שלב\\s*1\\s*מתוך\\s*${WIZARD.stages.length}|${WIZARD.stages[0]}`));
  });

  test('A client is offered every property type the calculator supports', async ({ calculatorFlow }) => {
    await allureStory('Property types');
    await allureSeverity('normal');
    await skipOnOutage(() => calculatorFlow.open());

    for (const type of PROPERTY_TYPES) {
      await expect(
        calculatorFlow.address.propertyTypeButtons[type],
        `the "${PROPERTY_TYPE_LABELS[type]}" property type is offered`,
      ).toBeVisible();
    }
  });

  // --- Step-1 gating -------------------------------------------------------

  test('Choosing only a property type does not let the client continue', async ({ calculatorFlow }) => {
    await allureStory('Step 1 gating');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    await expect(calculatorFlow.address.continueButton, 'continue starts disabled').toBeDisabled();

    // A type alone cannot identify a property — the address (or block/parcel) is required.
    await calculatorFlow.address.selectPropertyType('PROPERTY_TYPE_PRIVATE_HOUSE');
    await expect(
      calculatorFlow.address.continueButton,
      'continue stays disabled until the property is identified too',
    ).toBeDisabled();
  });

  test('Reloading returns the client to a clean property step', async ({ calculatorFlow, product, page }) => {
    await allureStory('Reload');
    await allureSeverity('normal');
    await skipOnOutage(() => calculatorFlow.open());

    await calculatorFlow.address.selectPropertyType('PROPERTY_TYPE_PRIVATE_HOUSE');
    await page.reload();

    await expect(page, 'the reload stays on the property step').toHaveURL(/\/calculator\/address/i);
    await expect(
      calculatorFlow.address.continueButton,
      'the reloaded step is back to its ungated starting state',
    ).toBeDisabled();
    expect(await product.app.isAuthenticated(), 'the reload does not conjure a session').toBe(false);
  });

  // --- Authentication boundary --------------------------------------------

  test('A visitor cannot reach the personal area', async ({ calculatorFlow, product, page }) => {
    await allureStory('Personal-area auth gate');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    await page.goto(PERSONAL_AREA_PATH);

    await expect(
      product.app.auth.loginDialog.heading,
      'the personal area demands a login instead of showing anyone offers',
    ).toBeVisible();
    expect(await product.app.isAuthenticated(), 'no session was created').toBe(false);
  });

  test('A visitor cannot deep-link into a saved characterization', async ({ calculatorFlow, product, page }) => {
    await allureStory('Wizard-step auth gate');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    // A real dev project: the point is that knowing its URL is not enough to open it.
    await page.goto(`/${GATED_ARENA_ID}/calculator/roof/${GATED_ROOF_ID}/marking`);

    await expect(
      product.app.auth.loginDialog.heading,
      "another customer's roof step demands a login",
    ).toBeVisible();
    expect(await product.app.isAuthenticated(), 'no session was created').toBe(false);
  });

  // --- Step-1 interaction --------------------------------------------------

  test('A client can dismiss the mapping agent’s message', async ({ calculatorFlow, page }) => {
    await allureStory('Agent bubble');
    await allureSeverity('minor');
    await skipOnOutage(() => calculatorFlow.open());

    const bubble = page.getByText(AGENT_BUBBLE).first();
    await expect(bubble, "Solara's coaching message greets the client").toBeVisible();

    await page.getByRole('button', { name: AGENT_BUBBLE_CLOSE }).first().click();
    await expect(bubble, 'dismissing the message clears it out of the way').toBeHidden();
  });

  test('Switching identification tabs swaps the controls and keeps the property types', async ({ calculatorFlow }) => {
    await allureStory('Tab round-trip');
    await allureSeverity('normal');
    await skipOnOutage(() => calculatorFlow.open());

    await calculatorFlow.address.switchToBlockParcelTab();
    await expect(
      calculatorFlow.address.addressBox,
      'the address combobox gives way to the block/parcel fields',
    ).toBeHidden();

    await calculatorFlow.address.switchToAddressTab();
    await expect(calculatorFlow.address.addressBox, 'switching back restores the address combobox').toBeVisible();
    await expect(
      calculatorFlow.address.blockField,
      'switching back hides the block field again',
    ).toBeHidden();
    await expect(
      calculatorFlow.address.propertyTypeButtons.PROPERTY_TYPE_PRIVATE_HOUSE,
      'the property types survive the round-trip — they belong to the step, not the tab',
    ).toBeVisible();
  });

  // --- Navigation ----------------------------------------------------------

  test('Browser back returns the client to the calculator', async ({ calculatorFlow, page }) => {
    await allureStory('History navigation');
    await allureSeverity('normal');
    await skipOnOutage(() => calculatorFlow.open());

    await page.goto(PERSONAL_AREA_PATH);
    await expect(page, 'the client navigated away from the calculator').toHaveURL(/\/pricing\//i);

    await page.goBack();
    await expect(page, 'going back lands on the calculator again').toHaveURL(/\/calculator\//i);
    expect(await calculatorFlow.tracker.isVisible(), 'the wizard is usable after going back').toBe(true);
  });

  // --- The hand-off a client must opt into ---------------------------------

  test('The agent hand-off is offered alongside the self-service path', async ({ calculatorFlow, page }) => {
    await allureStory('Agent hand-off');
    await allureSeverity('normal');
    await skipOnOutage(() => calculatorFlow.open());

    // Asserted present and DELIBERATELY never clicked: it hands the characterization to
    // Organuz's agents and creates a real lead.
    await expect(
      page.getByRole('button', { name: AGENT_HANDOFF_CTA }),
      'the client can hand the whole characterization to the agents',
    ).toBeVisible();
    await expect(
      calculatorFlow.address.continueButton,
      'the self-service path is offered too, gated until the property is identified',
    ).toBeDisabled();
  });
});
