/**
 * End-to-end coverage of the two parts of the calculator wizard no earlier spec drove:
 * the "company"/contractor role actually walking the wizard, and the block/parcel
 * ("גוש/חלקה") property-identification tab on step 1 — the way a professional identifies
 * a property without a street address. Every wizard spec before this file
 * (`customer-process-e2e.spec.ts`, `tests/product/journeys/**`) drives only the `customer`
 * persona, and none of them touches the block/parcel tab at all.
 *
 * TWO REAL PRODUCT DEFECTS, confirmed LIVE against PROD (energy.organuz.com) on
 * 2026-09-27 with the Playwright MCP. This suite targets DEV by default
 * (`dev1.app.organize.organuz.com`) and dev is password-gated; per this task's
 * instructions this run had no dev credentials to spend on manual exploration, so whether
 * dev's block/parcel tab matches prod (same labels, same defects) is UNVERIFIED — flagged
 * here and in the task report, not silently assumed. Checks 2 and 3 below assert the
 * CORRECT behaviour and are EXPECTED RED until the product is fixed — that is deliberate,
 * agreed with the team, and repeated at each test:
 *
 *   1. "מצא" (find) ENABLES with only "גוש" (block) filled and "חלקה" (parcel) EMPTY.
 *      A block without a parcel does not identify a property — it should stay disabled.
 *   2. Clicking "מצא" in that state SILENTLY CLEARS "גוש", returns the button to
 *      disabled, and shows no error, no toast, no validation text at all. The user's
 *      input vanishes unexplained — it should instead be preserved with a validation
 *      message shown.
 *
 * ALSO OBSERVED live, and NOT turned into a test here per instruction: the property-type
 * buttons (בית פרטי / בניין מגורים / מבנה מסחרי / מבנה חקלאי / מבנה ציבורי) expose NO
 * selected state to the accessibility tree — no `aria-pressed`, no `[selected]` — so
 * which type is chosen is conveyed by styling alone. Flagged for whoever picks this up
 * next.
 *
 * Skip policy (sanctioned — see the test-suite-parity skill):
 *  - Group A (checks 1-6) is deterministic: no login, no live geocode. It never calls
 *    skipGeocodeDrivingOnCi() — only skipOnOutage() guards the open, same as
 *    customer-process-e2e's first (tracker) check;
 *  - Group B (checks 7-10) drives the LIVE "company" role through the wizard: opt-in
 *    behind PRODUCT_WIZARD_E2E, local-only via skipGeocodeDrivingOnCi() (the live address
 *    geocode), gated by skipOnOutage() around the wizard-driving actions, and resumes the
 *    role's saved session via resumeOrSkip() instead of a fresh phone+OTP login — the same
 *    pattern as `company-role-e2e.spec.ts`.
 *  - Checks 8-9 are the FIRST live exercise of `ProductResultsPage`/`characterizeRoof` /
 *    `answerFunding` / `expectPostFundingDestination` / `openQuotationsFromResults` —
 *    those methods were already wired through `ProductAppPage` before this change but
 *    (confirmed by a repo-wide search) no spec had ever called them. Their selectors are
 *    therefore best-effort (testId guesses + broad text/role fallbacks), not confirmed
 *    against the live app the way the rest of this file's selectors are.
 */
import { test, expect } from '../support/fixtures';
import { skipOnOutage, skipGeocodeDrivingOnCi, resumeOrSkip } from '../support/envGate';
import { MAIN_PROPERTY_CHARACTERIZATION, PRODUCT_PERSONAS, PROPERTY_TYPE_LABELS } from '../matrix/e2e-matrix.data';
import { WIZARD } from '../../../src/pages/product';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../../src/utils/allure';

const wizardE2eEnabled = process.env.PRODUCT_WIZARD_E2E === 'true';
const scenario = MAIN_PROPERTY_CHARACTERIZATION;
const COMPANY_PERSONA = PRODUCT_PERSONAS.find((persona) => persona.id === 'company')!;
// The three non-residential property types a contractor/company characterizes (task scope
// excludes the two residential types, which the existing customer specs already cover).
const NON_RESIDENTIAL_TYPES = ['PROPERTY_TYPE_COMMERCIAL', 'PROPERTY_TYPE_AGRICULTURAL', 'PROPERTY_TYPE_PUBLIC'] as const;

test.describe('Contractor wizard — block/parcel + company role', { tag: ['@product', '@wizard'] }, () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async () => {
    await allureEpic('Product app');
    await allureFeature('Contractor characterization process');
  });

  // --- Group A: deterministic, no login, no live geocode ---------------------

  test('The block/parcel tab exposes block, parcel, and a find button that starts disabled', async ({ calculatorFlow }) => {
    await allureStory('Block/parcel tab controls');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    await calculatorFlow.address.switchToBlockParcelTab();

    await expect(calculatorFlow.address.blockField, 'the block ("גוש") field is exposed').toBeVisible();
    await expect(calculatorFlow.address.parcelField, 'the parcel ("חלקה") field is exposed').toBeVisible();
    await expect(
      calculatorFlow.address.findBlockParcelButton,
      'find starts disabled before either field is filled',
    ).toBeDisabled();
  });

  test('Find stays disabled until BOTH block and parcel are filled', async ({ calculatorFlow }) => {
    await allureStory('Block/parcel gating — defect 1 (expected RED)');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    await calculatorFlow.address.switchToBlockParcelTab();
    await calculatorFlow.address.fillBlock('6941');

    // CONFIRMED LIVE DEFECT (prod, 2026-09-27): today "מצא" enables here. This assertion
    // describes the CORRECT behaviour — a block alone cannot identify a property — and is
    // expected to FAIL until the product is fixed. Deliberate, agreed with the team.
    await expect(
      calculatorFlow.address.findBlockParcelButton,
      'find stays disabled with only the block filled — a block alone cannot identify a property',
    ).toBeDisabled();

    await calculatorFlow.address.fillParcel('15');
    await expect(
      calculatorFlow.address.findBlockParcelButton,
      'find enables once both block and parcel are filled',
    ).toBeEnabled();
  });

  test('Submitting a lone block preserves the input and surfaces a validation message', async ({ calculatorFlow }) => {
    await allureStory('Block/parcel gating — defect 2 (expected RED)');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    await calculatorFlow.address.switchToBlockParcelTab();
    await calculatorFlow.address.fillBlock('6941');
    // Enabled today only because of defect 1 above — this is exactly how the defect
    // was reproduced live: fill the block alone, then submit.
    await calculatorFlow.address.submitBlockParcel();

    // CONFIRMED LIVE DEFECT (prod, 2026-09-27): clicking "מצא" here silently CLEARS
    // "גוש", returns the button to disabled, and shows no error/toast/validation text at
    // all. These two assertions describe the CORRECT behaviour and are expected to FAIL
    // until the product is fixed. Deliberate, agreed with the team.
    await expect(
      calculatorFlow.address.blockField,
      'the typed block value is preserved, not silently cleared',
    ).toHaveValue('6941');
    await expect(
      calculatorFlow.address.blockParcelValidation,
      'a validation message explains the missing parcel',
    ).toBeVisible();
  });

  test('Switching tabs swaps the input controls — address and block/parcel are mutually exclusive', async ({ calculatorFlow }) => {
    await allureStory('Tab mutual exclusivity');
    await allureSeverity('normal');
    await skipOnOutage(() => calculatorFlow.open());

    await expect(calculatorFlow.address.addressBox, 'the address combobox is shown by default').toBeVisible();
    await expect(calculatorFlow.address.blockField, 'the block field is not rendered on the address tab').toBeHidden();

    await calculatorFlow.address.switchToBlockParcelTab();
    await expect(calculatorFlow.address.blockField, 'the block field is shown on its own tab').toBeVisible();
    await expect(calculatorFlow.address.parcelField, 'the parcel field is shown on its own tab').toBeVisible();
    await expect(
      calculatorFlow.address.addressBox,
      'the address combobox is not rendered on the block/parcel tab',
    ).toBeHidden();

    await calculatorFlow.address.switchToAddressTab();
    await expect(calculatorFlow.address.addressBox, 'switching back restores the address combobox').toBeVisible();
    await expect(calculatorFlow.address.blockField, 'switching back hides the block field again').toBeHidden();
  });

  test('The wizard offers the three non-residential property types a contractor characterizes', async ({ calculatorFlow }) => {
    await allureStory('Contractor property types');
    await allureSeverity('normal');
    await skipOnOutage(() => calculatorFlow.open());

    for (const type of NON_RESIDENTIAL_TYPES) {
      await expect(
        calculatorFlow.address.propertyTypeButtons[type],
        `the "${PROPERTY_TYPE_LABELS[type]}" property type is offered`,
      ).toBeVisible();
    }
  });

  test('The step tracker renders all seven characterization stages', async ({ calculatorFlow }) => {
    await allureStory('Step tracker stage count');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    expect(await calculatorFlow.tracker.isVisible(), 'the step tracker rendered').toBe(true);

    // Desktop renders one listitem per stage; the product project's narrow viewport
    // instead renders a single "שלב N מתוך M" indicator (see StepTracker.stages()) — cover
    // whichever shape actually renders rather than assume one.
    const listItemCount = await calculatorFlow.tracker.list.getByRole('listitem').count();
    if (listItemCount > 0) {
      expect(listItemCount, 'the tracker renders one listitem per wizard stage').toBe(WIZARD.stages.length);
    } else {
      const indicatorText = (await calculatorFlow.tracker.mobileIndicator.innerText()).trim();
      const match = indicatorText.match(/(\d+)\s*(?:מתוך|of)\s*(\d+)/i);
      expect(match, 'the mobile indicator reports "stage N of M"').toBeTruthy();
      expect(
        Number(match?.[2]),
        'the mobile indicator pins the same 7-stage total as WIZARD.stages',
      ).toBe(WIZARD.stages.length);
    }
  });

  // --- Group B: live "company" through the wizard (opt-in, skip-safe) --------

  test.describe('Company role through the wizard (live)', { tag: ['@company'] }, () => {
    test.use({ authRole: 'company' });

    test('A company characterizes a property through to the roof-type step', async ({ product, page }) => {
      skipGeocodeDrivingOnCi(); // drives the live address autocomplete during characterization — local-only
      test.skip(!wizardE2eEnabled, 'PRODUCT_WIZARD_E2E not set — skips the project-creating scan on dev');
      await allureStory('Company characterization');
      await allureSeverity('critical');

      await resumeOrSkip(product, 'company');
      let ids: Awaited<ReturnType<typeof product.characterizeToRoofType>> | undefined;
      await skipOnOutage(async () => {
        ids = await product.characterizeToRoofType(scenario);
      });

      await expect(page, 'the company journey ends on the roof-type step').toHaveURL(/\/roof\/[^/]+\/type/i);
      expect(ids?.projectId, 'project id parsed from the roof URL').toBeTruthy();
      expect(ids?.quotationId, 'roof id parsed from the roof URL').toBeTruthy();
    });

    test('A funded company lands on results, matching the persona contract', async ({ product }) => {
      skipGeocodeDrivingOnCi(); // also drives the live geocode during characterization — local-only
      test.skip(!wizardE2eEnabled, 'PRODUCT_WIZARD_E2E not set — skips the project-creating scan on dev');
      await allureStory('Post-funding destination');
      await allureSeverity('critical');

      await resumeOrSkip(product, 'company');
      await skipOnOutage(async () => {
        await product.characterizeToRoofType(scenario);
        await product.app.characterizeRoof(scenario);
        await product.app.answerFunding(scenario);
      });

      // The FIRST live check of the expectedPostFundingDestination contract for
      // "company" (product-personas.data.ts) — every other reference to it today is
      // offline (the matrix data-contract / roles-contract specs compare the data to
      // itself, never the live app).
      await product.app.expectPostFundingDestination(COMPANY_PERSONA);
    });

    test('A company cannot open the quotations list from results', async ({ product }) => {
      skipGeocodeDrivingOnCi(); // also drives the live geocode during characterization — local-only
      test.skip(!wizardE2eEnabled, 'PRODUCT_WIZARD_E2E not set — skips the project-creating scan on dev');
      await allureStory('Quotations access');
      await allureSeverity('critical');

      expect(
        COMPANY_PERSONA.canOpenQuotationsFromResults,
        'the persona contract says company cannot reach quotations from results',
      ).toBe(false);

      await resumeOrSkip(product, 'company');
      await skipOnOutage(async () => {
        await product.characterizeToRoofType(scenario);
        await product.app.characterizeRoof(scenario);
        await product.app.answerFunding(scenario);
      });

      // Live negative check: the results page renders no quotations-from-results
      // affordance for company, not merely that clicking one would fail.
      await product.app.expectQuotationsUnavailable();
    });

    test.describe('through the progress tracker', () => {
      // DESKTOP viewport, overriding the project's 600x800 — confirmed live (see the
      // equivalent customer journey 4 in customer-full-journey-e2e.spec.ts): the narrow
      // layout renders no stage list at all, so the "חזרה לשלב …" back-navigation buttons
      // this test walks simply do not exist there.
      test.use({ viewport: { width: 1280, height: 900 } });

      test('company session survives the tracker\'s back-navigation to stage 1', async ({ product, calculatorFlow, page }) => {
        skipGeocodeDrivingOnCi(); // also drives the live geocode during characterization — local-only
        test.skip(!wizardE2eEnabled, 'PRODUCT_WIZARD_E2E not set — skips the project-creating scan on dev');
        await allureStory('Tracker back-navigation');
        await allureSeverity('normal');

        await resumeOrSkip(product, 'company');
        await skipOnOutage(async () => {
          await product.characterizeToRoofType(scenario);
        });

        // A completed stage becomes a "חזרה לשלב …" button — the wizard's only in-app way back.
        await calculatorFlow.goBackToStage(WIZARD.stages[0]);

        await expect(page, 'the wizard returned to the property step').toHaveURL(/\/calculator\/address/i);
        expect(await calculatorFlow.tracker.isVisible(), 'the tracker survived the walk back').toBe(true);
        expect(
          await product.app.isAuthenticated(),
          'the company session survived the back-navigation',
        ).toBe(true);
      });
    });
  });
});
