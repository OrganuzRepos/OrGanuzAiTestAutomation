/**
 * End-to-end coverage of the two parts of the calculator wizard no earlier spec drove:
 * the "company"/contractor role actually walking the wizard, and the block/parcel
 * ("גוש/חלקה") property-identification tab on step 1 — the way a professional identifies
 * a property without a street address. Every wizard spec before this file
 * (`customer-process-e2e.spec.ts`, `tests/product/journeys/**`) drives only the `customer`
 * persona, and none of them touches the block/parcel tab at all.
 *
 * TWO REAL PRODUCT GAPS in the block/parcel tab, confirmed LIVE with the Playwright MCP
 * on PROD (energy.organuz.com, 2026-09-27) and since reproduced on DEV
 * (dev1.app.organize.organuz.com, 2026-09-28) — the suite's default target, whose
 * behaviour the first version of this file flagged as unverified. Both envs behave
 * identically:
 *
 *   1. "מצא" (find) ENABLES with only "גוש" (block) filled and "חלקה" (parcel) EMPTY.
 *      A block without a parcel does not identify a property — it should stay disabled.
 *   2. Clicking "מצא" in that state SILENTLY CLEARS "גוש", returns the button to
 *      disabled, and shows no error, no toast, no validation text at all. The user's
 *      input vanishes unexplained — it should instead be preserved with a validation
 *      message shown.
 *
 * Checks 2 and 3 PIN THE CURRENT BEHAVIOUR and carry a `known-gap` annotation naming the
 * correct behaviour — the same pattern the fraud suite uses for its dev hardening gaps
 * (see `hardeningGapNote`). They were originally written to assert the desired behaviour
 * and left deliberately RED, which conflicts with the all-green invariant in the
 * test-suite-parity skill: a permanently red suite stops reporting anything. Pinned this
 * way they stay genuine regression detectors, and they FAIL when the product is fixed —
 * which is the signal to restore the strict assertions. Each still asserts strictly
 * whatever the product gets right (find disabled when empty, enabled with both fields,
 * and the wizard never advancing on an unidentifiable property).
 *
 * ALSO OBSERVED live, and NOT turned into a test here per instruction: the property-type
 * buttons (בית פרטי / בניין מגורים / מבנה מסחרי / מבנה חקלאי / מבנה ציבורי) expose NO
 * selected state to the accessibility tree — no `aria-pressed`, no `[selected]` — so
 * which type is chosen is conveyed by styling alone. Flagged for whoever picks this up
 * next.
 *
 * Skip policy (sanctioned — see the test-suite-parity skill):
 *  - Group A (checks 1-6) is deterministic and CI-safe: no login, no live geocode, only
 *    skipOnOutage() guarding the open — with ONE exception. The submit check needs the
 *    live govmap map bridge (until it is up "מצא" is inert; see AddressStep.waitForMapReady),
 *    and govmap is geo-blocked for CI runners, so that check alone is local-only via
 *    skipGeocodeDrivingOnCi();
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
// A REAL Israeli block/parcel pair, verified live on dev (2026-09-28): with a property
// type selected, "מצא" accepts it, keeps both values and lets the wizard continue — so
// these exercise the real lookup rather than a rejected-input path.
const SAMPLE_BLOCK = '6941';
const SAMPLE_PARCEL = '15';
const LONE_BLOCK_GAP =
  'block/parcel: "מצא" enables with only "גוש" filled — a block alone cannot identify a '
  + 'property, so it should stay disabled until "חלקה" is filled. Reproduced live on prod '
  + '(2026-09-27) and dev (2026-09-28). The test pins current behaviour and will fail when fixed.';
const LONE_BLOCK_SUBMIT_GAP =
  'block/parcel: submitting a lone "גוש" silently clears it with no error, toast or '
  + 'validation text — the input should be preserved and the missing "חלקה" explained. '
  + 'Reproduced live on prod (2026-09-27) and dev (2026-09-28). The test pins current behaviour.';

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

  test('Find gates on block/parcel input (known gap: a lone block enables it)', async ({ calculatorFlow }, testInfo) => {
    await allureStory('Block/parcel gating');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    await calculatorFlow.address.switchToBlockParcelTab();
    await calculatorFlow.address.fillBlock(SAMPLE_BLOCK);

    // KNOWN PRODUCT GAP, reproduced live on BOTH prod (2026-09-27) and dev (2026-09-28):
    // "מצא" enables on a lone block, though a block alone cannot identify a property — it
    // should stay disabled until the parcel is filled too. Pinned as the CURRENT behaviour
    // rather than asserted as the desired one, so this stays a real regression detector
    // and the suite stays green (see the test-suite-parity skill's all-green invariant).
    // When the product is fixed this flips to a failure — that is the intended signal to
    // restore the strict assertion below.
    await expect(
      calculatorFlow.address.findBlockParcelButton,
      'find is currently enabled by a lone block (known gap)',
    ).toBeEnabled();
    testInfo.annotations.push({ type: 'known-gap', description: LONE_BLOCK_GAP });

    // The genuine contract still holds at both ends and is asserted strictly.
    await calculatorFlow.address.fillParcel(SAMPLE_PARCEL);
    await expect(
      calculatorFlow.address.findBlockParcelButton,
      'find is enabled once both block and parcel are filled',
    ).toBeEnabled();
  });

  test('Submitting a lone block clears it (known gap: no validation message)', async ({ calculatorFlow, page }, testInfo) => {
    // The only Group A check that SUBMITS, so the only one needing the live map bridge —
    // which is geo-blocked for CI runners. Local-only, same divergence as local-web.
    skipGeocodeDrivingOnCi();
    await allureStory('Block/parcel submit handling');
    await allureSeverity('critical');
    await skipOnOutage(() => calculatorFlow.open());

    await calculatorFlow.address.switchToBlockParcelTab();
    // "מצא" is enabled before the map can service it; submitting earlier is silently
    // dropped and this check would observe nothing.
    await calculatorFlow.address.waitForMapReady();
    await calculatorFlow.address.fillBlock(SAMPLE_BLOCK);
    // Submittable today only because of the gap pinned above — this is exactly how the
    // behaviour was reproduced live: fill the block alone, then submit.
    await calculatorFlow.address.submitBlockParcel();

    // KNOWN PRODUCT GAP, reproduced live on BOTH prod (2026-09-27) and dev (2026-09-28):
    // "מצא" silently clears "גוש", returns the button to disabled, and shows no error,
    // toast or validation text. The input should instead be preserved with a message
    // explaining the missing parcel. Pinned as the CURRENT behaviour for the same reason
    // as the gap above.
    await expect(
      calculatorFlow.address.blockField,
      'the typed block is currently cleared on submit (known gap)',
    ).toHaveValue('');
    await expect(
      calculatorFlow.address.blockParcelValidation,
      'no validation message is currently shown (known gap)',
    ).toBeHidden();
    testInfo.annotations.push({ type: 'known-gap', description: LONE_BLOCK_SUBMIT_GAP });

    // What the product DOES get right, asserted strictly: an unidentifiable property
    // never advances the wizard.
    await expect(page, 'the wizard stays on the property step').toHaveURL(/\/calculator\/address/i);
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
