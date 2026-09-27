import { expect } from '@playwright/test';
import { ProductFlows } from '../ProductFlows';
import {
  StepTracker,
  AddressStep,
  PropertyConfirmStep,
  RoofTypeStep,
  MyOffersPage,
  WIZARD,
} from '../../../../src/pages/product';
import type { ProductRuntimeIds } from '../ProductAppPage';
import type { PropertyCharacterizationData } from '../../matrix/e2e-matrix.data';

/**
 * Mid-layer flow for the calculator characterization wizard. Sits BETWEEN the step page
 * objects (StepTracker/AddressStep/PropertyConfirmStep — initialized by fixtures) and the
 * test bodies: it composes those pages into named customer journeys so specs read as
 * intent ("locate property", "confirm expecting the auth gate") instead of low-level
 * clicks. Initialized by the `calculatorFlow` fixture (see flow-fixtures.ts); the same
 * page-object → flow → test layering as ProductFlows wraps ProductAppPage.
 *
 * Keep test-lifecycle (skip) decisions OUT of here — a flow throws the typed
 * environmental errors (AppUnavailableError / OtpUnavailableError, via ProductFlows) and
 * the spec edge decides whether to skip, per the errors.ts convention.
 */
export class CalculatorFlow {
  constructor(
    private readonly product: ProductFlows,
    readonly tracker: StepTracker,
    readonly address: AddressStep,
    readonly confirm: PropertyConfirmStep,
    readonly roofType: RoofTypeStep,
    readonly offers: MyOffersPage,
  ) {}

  /** Open the calculator shell (unlock the dev gate) and land on wizard step 1. */
  async open(): Promise<void> {
    await this.product.openCalculator();
  }

  /** The wizard stage labels from the progress tracker. */
  async stages(): Promise<string[]> {
    return this.tracker.stages();
  }

  /**
   * Step 1 → step 2: choose a property type + address and continue to the auto-located
   * property confirmation ("מצאנו את הנכס המבוקש"). Non-mutating — no project is created
   * until the property is confirmed.
   */
  async locateProperty(
    type: PropertyCharacterizationData['propertyType'],
    address: string,
  ): Promise<void> {
    await this.address.choose(type, address);
    await this.address.continue();
    await this.confirm.waitFor();
  }

  /**
   * Confirm the located property and report whether the app demands authentication (the
   * "הרשמת בעלי נכסים" gate). For a signed-out visitor this is the public/authenticated
   * boundary of the customer process — the satellite scan runs only once logged in.
   */
  async confirmExpectingAuthGate(): Promise<boolean> {
    await this.confirm.confirm();
    return this.confirm.requiresLogin();
  }

  /**
   * The full authenticated customer journey: log in as the customer, then characterize
   * the property through the automated portion (property → satellite scan → AI boundary →
   * obstacles → roof-type step). Creates a REAL project on dev. Returns the runtime ids
   * (projectId + roofId) parsed from the roof URL.
   */
  async characterizeAsCustomer(scenario: PropertyCharacterizationData): Promise<ProductRuntimeIds> {
    await this.product.loginAs('customer');
    return this.product.characterizeToRoofType(scenario);
  }

  /** Log in as the customer without driving any wizard step (so a spec can stage the
   *  wizard stages itself). Idempotent — a resumed/persisted session returns early. */
  async loginAsCustomer(): Promise<void> {
    await this.product.loginAs('customer');
  }

  /**
   * Open the personal area and reopen the saved project back in the wizard — the
   * customer's "come back later and carry on" path. Returns the runtime ids of the
   * reopened project so a spec can assert it is the SAME project it created.
   */
  async reopenSavedProject(): Promise<ProductRuntimeIds> {
    await this.product.openPersonalArea();
    await this.offers.openFirstProject();
    return this.product.app.captureRoofRuntimeIds();
  }

  /**
   * Drive a FRESH characterization all the way to the roof-type step. Journeys that act
   * on that step must use this, not a resumed project.
   *
   * Confirmed live, three ways a "cheaper" route fails:
   *  - deep-linking …/roof/<id>/type renders the step but with no wizard state — the CTA
   *    falls back to the generic "בוא נמשיך" and clicking it does nothing;
   *  - reopening a saved project puts each marking step into an EDIT mode that only the
   *    "סיימתי, אפשר להמשיך" confirm advances;
   *  - and arriving that way still lands on a view-only …/type: no
   *    "סימנתי את השטח הרלוונטי" CTA and no "חזרה לשלב" tracker buttons.
   * So the step's guard and the tracker's back-navigation exist only on the scan-fresh
   * path. The cost is a real dev project per journey — which is why these are opt-in.
   */
  async characterizeToRoofTypeAsCustomer(
    scenario: PropertyCharacterizationData,
  ): Promise<ProductRuntimeIds> {
    return this.characterizeAsCustomer(scenario);
  }

  /**
   * Try to leave the roof-type step without marking a roof. The wizard must refuse:
   * the guard dialog appears and the URL stays on …/type. Returns whether it refused.
   */
  async expectRoofTypeGuard(): Promise<boolean> {
    await this.roofType.waitFor();
    await this.roofType.attemptContinue();
    return this.roofType.isGuarded();
  }

  /**
   * Walk back to an already-completed stage through the progress tracker. The caller
   * asserts the destination with expect(page).toHaveURL(...) — auto-waiting covers the
   * navigation, so the flow stays free of lifecycle/waiting policy.
   */
  async goBackToStage(stage: string): Promise<void> {
    await expect(this.tracker.backToStageButton(stage)).toBeVisible({ timeout: 20_000 });
    await this.tracker.goBackToStage(stage);
  }

  /** The stage labels the wizard has revealed so far, in order. */
  async revealedStages(): Promise<string[]> {
    return this.tracker.stages();
  }

  /** The full, ordered stage roster the wizard is expected to expose. */
  static get expectedStages(): readonly string[] {
    return WIZARD.stages;
  }

  /**
   * Post-scan wizard leg (stages 3–4): accept the AI-detected roof boundary (the
   * area-marking step) and skip obstacle marking (placement-elements), landing on the roof-type step
   * (…/roof/<id>/type). Returns the runtime ids (projectId + roofId) parsed from the URL.
   * The roof-type step needs live map drawing, so it is the automation terminus.
   */
  async advanceAutoDetectedRoof(): Promise<ProductRuntimeIds> {
    return this.product.advanceAutoDetectedRoof();
  }
}
