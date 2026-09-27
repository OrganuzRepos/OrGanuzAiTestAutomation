import { Locator, Page } from '@playwright/test';
import { allureStep } from '../../utils/allure';
import { WIZARD } from './wizardControls';

/**
 * Wizard step "מיקום המערכת ובחירת סוג הגג" (…/roof/<id>/type) — the customer picks the
 * roof surface type and marks where the system goes.
 *
 * This is the automation terminus of the characterization journey: the roof-type picker
 * and the area drawing live INSIDE the map iframe (…/iframe/roof/index.html), which
 * exposes no named controls, so a test cannot mark a roof deterministically. What IS
 * deterministic — and worth asserting — is the step's guard: clicking the CTA with
 * nothing marked raises "יש לבחור את סוג הגג ואת המיקום…" and the wizard stays put.
 *
 * Isolated page object exposed as the `roofTypeStep` fixture.
 */
export class RoofTypeStep {
  /** The step heading. */
  readonly heading: Locator;
  /** This step's own CTA (it replaces the generic "בוא נמשיך"). */
  readonly continueButton: Locator;
  /** The guard dialog shown when nothing is marked yet. */
  readonly guardDialog: Locator;
  /** The roof editor iframe that owns the roof-type picker + drawing surface. */
  readonly editorFrame: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByText(WIZARD.roofTypeHeading).first();
    this.continueButton = page.getByRole('button', { name: WIZARD.roofTypeContinue }).first();
    this.guardDialog = page.getByText(WIZARD.roofTypeGuard).first();
    this.editorFrame = page.locator('iframe[src*="/iframe/roof/"]');
  }

  /** Wait until the roof-type step has rendered. */
  async waitFor(): Promise<void> {
    await this.heading.waitFor({ state: 'visible', timeout: 45_000 });
  }

  /** Click the step CTA (without marking a roof this is expected to be refused). */
  async attemptContinue(): Promise<void> {
    await allureStep('Continue from the roof-type step', () => this.continueButton.click());
  }

  /** True when the "choose a roof type first" guard is on screen. */
  async isGuarded(): Promise<boolean> {
    return this.guardDialog.isVisible({ timeout: 15_000 }).catch(() => false);
  }
}
