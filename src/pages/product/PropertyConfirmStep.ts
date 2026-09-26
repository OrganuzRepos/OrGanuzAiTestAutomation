import { Locator, Page } from '@playwright/test';
import { allureStep } from '../../utils/allure';
import { WIZARD } from './wizardControls';

/**
 * Wizard step 2 — the auto-located property confirmation ("מצאנו את הנכס המבוקש!"). The
 * pin is placed automatically; the user confirms with "זהו הנכס המבוקש, אפשר להמשיך".
 *
 * IMPORTANT (confirmed live): confirming as a signed-out visitor pops the property-owner
 * auth gate ("הרשמת בעלי נכסים") — the satellite scan that creates the project runs only
 * once the customer is authenticated. So this step is the public/authenticated boundary
 * of the customer process. Isolated page object exposed as the `propertyConfirm` fixture.
 */
export class PropertyConfirmStep {
  /** The "we found the requested property" confirmation banner. */
  readonly banner: Locator;
  /** The confirm CTA ("זהו הנכס המבוקש, אפשר להמשיך"). */
  readonly confirmButton: Locator;
  /** The post-confirm auth gate heading shown to signed-out visitors ("הרשמת בעלי נכסים"). */
  readonly authGateHeading: Locator;

  constructor(page: Page) {
    this.banner = page.getByText(WIZARD.propertyFoundBanner).first();
    this.confirmButton = page.getByRole('button', { name: WIZARD.confirmProperty }).first();
    this.authGateHeading = page.getByRole('heading', { name: WIZARD.authGateHeading });
  }

  /** Wait until the confirmation screen has rendered. */
  async waitFor(): Promise<void> {
    await this.banner.waitFor({ state: 'visible', timeout: 45_000 });
  }

  /** Click confirm. As a signed-out visitor this surfaces the auth gate; authenticated it scans. */
  async confirm(): Promise<void> {
    await allureStep('Confirm the located property', () => this.confirmButton.click());
  }

  /** True when the auth gate appeared (i.e. login is required to run the scan). */
  async requiresLogin(): Promise<boolean> {
    return this.authGateHeading.isVisible({ timeout: 15_000 }).catch(() => false);
  }
}
