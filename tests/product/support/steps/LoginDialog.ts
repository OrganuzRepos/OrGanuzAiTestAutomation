import { Locator, Page } from '@playwright/test';
import { allureStep } from '../../../../src/utils/allure';
import { LOGIN } from './authControls';

/**
 * The cellular (phone + OTP) login dialog — isolated page object exposed as the
 * `loginDialog` fixture. Covers the mobile-number entry, the send-code gating, the
 * registration entry points, and (only when a code is actually requested) the OTP step.
 *
 * SAFE BY DEFAULT: nothing here sends an OTP except requestOtp(), which callers gate
 * behind an opt-in flag — the dev backend rate-limits OTP sends per number (see the
 * organuz-product-e2e skill), so the UI-state checks deliberately never click send.
 */
export class LoginDialog {
  constructor(private readonly page: Page) {}

  /** The header CTA that opens the dialog ("הרשמה / כניסה" / EN "Login / Register"). */
  entryButton(): Locator {
    return this.page.getByRole('button', { name: LOGIN.entry }).first();
  }

  dialog(): Locator {
    return this.page.getByRole('dialog').first();
  }

  heading(): Locator {
    return this.page.getByRole('heading', { name: LOGIN.dialogHeading });
  }

  /** The mobile-number prompt paragraph. */
  prompt(): Locator {
    return this.page.getByText(LOGIN.prompt);
  }

  /** The cellular-number input. */
  phoneField(): Locator {
    return this.page.getByRole('textbox', { name: LOGIN.phoneField }).first();
  }

  /** The "send me a verification code" button (disabled until a valid number is entered). */
  sendCodeButton(): Locator {
    return this.page.getByRole('button', { name: LOGIN.sendCode }).first();
  }

  closeButton(): Locator {
    return this.dialog().getByRole('button', { name: LOGIN.close });
  }

  /** Property-owner "register here" CTA (the first of the two in the dialog). */
  propertyOwnerRegister(): Locator {
    return this.dialog().getByRole('button', { name: LOGIN.register }).nth(0);
  }

  /** Solar-company / entrepreneur "register here" CTA (the second in the dialog). */
  solarCompanyRegister(): Locator {
    return this.dialog().getByRole('button', { name: LOGIN.register }).nth(1);
  }

  /** The OTP entry step heading (present only after a code is sent). */
  otpHeading(): Locator {
    return this.page.getByRole('heading', { name: LOGIN.otpHeading }).first();
  }

  /** The single-digit OTP boxes (present only after a code is sent). */
  otpBoxes(): Locator {
    return this.dialog().getByRole('textbox');
  }

  verifyButton(): Locator {
    return this.page.getByRole('button', { name: LOGIN.verify }).first();
  }

  /** Open the login dialog from the header entry point (idempotent). */
  async open(): Promise<void> {
    if (await this.dialog().isVisible().catch(() => false)) return;
    await allureStep('Open cellular login dialog', () => this.entryButton().click());
    await this.heading().waitFor({ state: 'visible', timeout: 15_000 });
  }

  /** Type a cellular number (fill, not type — the field has an input mask). */
  async enterMobileNumber(value: string): Promise<void> {
    await allureStep(`Enter mobile number "${value}"`, () => this.phoneField().fill(value));
  }

  /** Close the dialog. */
  async close(): Promise<void> {
    await allureStep('Close login dialog', () => this.closeButton().click());
  }

  /**
   * Request an OTP (clicks "send code"). TRIGGERS A REAL DEV OTP SEND — call only from an
   * opt-in, rate-limit-aware test, never from the default UI-state checks.
   */
  async requestOtp(): Promise<void> {
    await allureStep('Request verification code', () => this.sendCodeButton().click());
  }
}
