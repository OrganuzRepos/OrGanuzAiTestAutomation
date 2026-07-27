import { Page } from '@playwright/test';
import {
  ProductAppPage,
  ProductRuntimeIds,
  AppUnavailableError,
  APP_UNAVAILABLE_REASON,
} from './ProductAppPage';
import { unlockProductEnvironment } from './env-gate';
import { rolePhone, roleOtpCode, phoneKeyHint } from './roleCredentials';
import { PropertyCharacterizationData, ProductPersonaId } from '../matrix/e2e-matrix.data';
import { allureStep } from '../../../src/utils/allure';

/**
 * High-level, reusable product-app flows so specs stay short and readable.
 * Wraps ProductAppPage step methods into named end-to-end sequences.
 * See the organuz-product-e2e skill for the underlying wizard.
 */
export class ProductFlows {
  readonly app: ProductAppPage;

  constructor(
    private readonly page: Page,
    app: ProductAppPage,
  ) {
    this.app = app;
  }

  /** Open the calculator shell, unlocking the dev/test password gate (no-op on prod). */
  async openCalculator(): Promise<void> {
    await allureStep('Open calculator root', () => this.page.goto('/'));
    await unlockProductEnvironment(this.page);
    // No gate (already unlocked / prod): if only the header renders, the backend is down.
    if (!(await this.app.isAppShellLoaded())) {
      throw new AppUnavailableError(APP_UNAVAILABLE_REASON);
    }
  }

  /**
   * Resume a role's authenticated session from its saved storageState (written once
   * by the product-setup project). Opens the calculator, unlocks the dev gate, and
   * verifies the session was restored — if it wasn't (no saved session because setup
   * skipped on OTP cooldown), the test skips with a clear reason. Use this in per-role
   * specs instead of loginAs() so each role logs in only once per run.
   */
  async resumeSession(personaId: ProductPersonaId): Promise<void> {
    await this.openCalculator();
    if (!(await this.app.isAuthenticated())) {
      throw new Error(`No saved session for "${personaId}".`);
    }
  }

  /** Log in as a persona using its env credentials (phone + fixed dev OTP 7777). */
  async loginAs(personaId: ProductPersonaId): Promise<ProductRuntimeIds> {
    const phone = rolePhone(personaId);
    const otpCode = roleOtpCode(personaId);
    if (!phone) {
      throw new Error(`Missing ${phoneKeyHint(personaId)} for product persona "${personaId}".`);
    }
    return this.app.login({ phone, otpCode });
  }

  /** Switch the app UI to English via the header language menu (idempotent). */
  async switchToEnglish(): Promise<void> {
    await this.app.switchToEnglish();
  }

  /** Open the header user menu (exposes "איזור אישי" and "התנתק"). */
  async openUserMenu(): Promise<void> {
    await this.app.openUserMenu();
  }

  /** Open the user menu → personal area (…/pricing/my-offers). */
  async openPersonalArea(): Promise<void> {
    await this.app.openPersonalArea();
  }

  /** Click a personal-area sidebar entry by its Hebrew label (e.g. "מחירון קבלני"). */
  async openSidebarEntry(name: string | RegExp): Promise<void> {
    await this.app.openSidebarEntry(name);
  }

  /** Open the user menu → log out. */
  async logout(): Promise<void> {
    await this.app.logout();
  }

  /** Assert the app is signed out (public calculator + login entry available). */
  async expectLoggedOut(): Promise<void> {
    await this.app.expectLoggedOut();
  }

  /**
   * Drive the characterization wizard through its automated portion:
   * property type + address → satellite roof scan → AI-detected boundary →
   * obstacles → roof-type step. Returns the runtime ids from the URL.
   */
  async characterizeToRoofType(scenario: PropertyCharacterizationData): Promise<ProductRuntimeIds> {
    await this.app.createProject(scenario);
    return this.advanceAutoDetectedRoof();
  }

  /** Accept the detected boundary, skip obstacles, and stop at the roof-type step. */
  async advanceAutoDetectedRoof(): Promise<ProductRuntimeIds> {
    return this.app.advanceAutoDetectedRoof();
  }
}
