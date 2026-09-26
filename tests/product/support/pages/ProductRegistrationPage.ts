import { expect, type Locator, type Page } from '@playwright/test';
import { allureStep } from '../../../../src/utils/allure';
import { APP_UNAVAILABLE_REASON, AppUnavailableError, OtpUnavailableError } from '../errors';
import type { NewCustomerAccount } from '../product-page.types';
import { ProductAuthPage } from './ProductAuthPage';
import { ProductPageActions } from './ProductPageActions';
import { ProductShellPage } from './ProductShellPage';

/** Property-owner registration and solar-company lead-form entry. */
export class ProductRegistrationPage {
  readonly submitButton: Locator;
  readonly termsCheckbox: Locator;
  readonly optionalConsentCheckbox: Locator;

  constructor(
    private readonly page: Page,
    private readonly shell: ProductShellPage,
    private readonly auth: ProductAuthPage,
    private readonly actions: ProductPageActions,
  ) {
    this.submitButton = page.getByRole('button', { name: 'הרשמה והתחברות' });
    this.termsCheckbox = page.getByRole('checkbox').first();
    this.optionalConsentCheckbox = page.getByRole('checkbox').nth(1);
  }

  async openCustomerRegistration(): Promise<void> {
    await this.requireShell();
    await this.auth.openLoginDialog();
    await allureStep('Open property-owner registration', () =>
      this.page.getByRole('button', { name: 'הירשמו כאן' }).first().click());
    await expect(this.page.getByRole('heading', { name: 'הרשמת בעלי נכסים' }))
      .toBeVisible({ timeout: 15_000 });
  }

  async fillCustomerFields(account: NewCustomerAccount): Promise<void> {
    await allureStep('Fill registration first name', () =>
      this.page.getByRole('textbox', { name: 'שם פרטי' }).fill(account.firstName));
    await allureStep('Fill registration last name', () =>
      this.page.getByRole('textbox', { name: 'שם משפחה' }).fill(account.lastName));
    await allureStep('Fill registration phone', () =>
      this.page.getByRole('textbox', { name: 'טלפון נייד' }).fill(account.phone));
    await allureStep('Fill registration email', () =>
      this.page.getByRole('textbox', { name: 'דואר אלקטרוני' }).fill(account.email));
  }

  async acceptTerms(): Promise<void> {
    if (!(await this.termsCheckbox.isChecked())) {
      await allureStep('Accept registration terms', () => this.termsCheckbox.check());
    }
  }

  async submitCustomerRegistration(otpCode: string): Promise<void> {
    await expect(this.submitButton).toBeEnabled({ timeout: 10_000 });
    await allureStep('Submit registration', () => this.submitButton.click());

    const otpHeading = this.page
      .getByRole('heading', { name: /הזנת קוד|verification|קוד אימות|enter.*code/i })
      .first();
    try {
      await otpHeading.waitFor({ state: 'visible', timeout: 20_000 });
    } catch {
      throw new OtpUnavailableError(
        'Registration OTP step never rendered — dev OTP rate-limit cooldown or phone already registered.',
      );
    }

    await this.auth.fillOtpCode(otpCode);
    await this.actions.clickFirstVisible([
      this.page.getByTestId('verify-otp'),
      this.page.getByRole('button', { name: /אישור והתחברות|verify|continue|login|אימות|המשך|כניסה/i }),
    ]);
    await this.page.waitForLoadState('domcontentloaded');
    if (!(await this.auth.isLoggedIn())) {
      throw new OtpUnavailableError(
        'Registration did not authenticate the new account — likely dev OTP rate-limit cooldown.',
      );
    }
  }

  async openSolarCompanyRegistration(): Promise<Page> {
    await this.requireShell();
    await this.auth.openLoginDialog();
    const popupPromise = this.page.waitForEvent('popup');
    await allureStep('Open solar-company registration', () =>
      this.page.getByRole('button', { name: 'הירשמו כאן' }).nth(1).click());
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    return popup;
  }

  private async requireShell(): Promise<void> {
    if (!(await this.shell.isLoaded())) {
      throw new AppUnavailableError(APP_UNAVAILABLE_REASON);
    }
  }
}
