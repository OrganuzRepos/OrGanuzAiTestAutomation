import { Locator, Page } from '@playwright/test';
import { allureStep } from '../../utils/allure';
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
  /**
   * The header entry affordance, matching EITHER layout: the desktop text CTA
   * ("הרשמה / כניסה") or the mobile account icon. Use this to assert the entry point is
   * available; `open()` picks the correct per-layout path to actually open the dialog.
   */
  readonly entryButton: Locator;
  /** Desktop-only: the header text CTA that opens the dialog directly. */
  private readonly headerCta: Locator;
  /** Mobile-only: the header account icon (no accessible name) that opens the account menu. */
  private readonly headerMenuIcon: Locator;
  readonly dialog: Locator;
  readonly heading: Locator;
  /** The mobile-number prompt paragraph. */
  readonly prompt: Locator;
  /** The cellular-number input. */
  readonly phoneField: Locator;
  /** The "send me a verification code" button (disabled until a valid number is entered). */
  readonly sendCodeButton: Locator;
  readonly closeButton: Locator;
  /** Property-owner "register here" CTA (the first of the two in the dialog). */
  readonly propertyOwnerRegister: Locator;
  /** Solar-company / entrepreneur "register here" CTA (the second in the dialog). */
  readonly solarCompanyRegister: Locator;
  /** The OTP entry step heading (present only after a code is sent). */
  readonly otpHeading: Locator;
  /** The single-digit OTP boxes (present only after a code is sent). */
  readonly otpBoxes: Locator;
  readonly verifyButton: Locator;

  constructor(private readonly page: Page) {
    // `dialog` is initialized first — the close/register/OTP-box locators are scoped to it.
    this.dialog = page.getByRole('dialog').first();
    this.headerCta = page.getByRole('button', { name: LOGIN.entry }).first();
    // The mobile account icon is the lone button in the print-hidden header bar.
    this.headerMenuIcon = page.locator('.print_hide').getByRole('button').first();
    this.entryButton = this.headerCta.or(this.headerMenuIcon);
    this.heading = page.getByRole('heading', { name: LOGIN.dialogHeading });
    this.prompt = page.getByText(LOGIN.prompt);
    this.phoneField = page.getByRole('textbox', { name: LOGIN.phoneField }).first();
    this.sendCodeButton = page.getByRole('button', { name: LOGIN.sendCode }).first();
    this.closeButton = this.dialog.getByRole('button', { name: LOGIN.close });
    this.propertyOwnerRegister = this.dialog.getByRole('button', { name: LOGIN.register }).nth(0);
    this.solarCompanyRegister = this.dialog.getByRole('button', { name: LOGIN.register }).nth(1);
    this.otpHeading = page.getByRole('heading', { name: LOGIN.otpHeading }).first();
    this.otpBoxes = this.dialog.getByRole('textbox');
    this.verifyButton = page.getByRole('button', { name: LOGIN.verify }).first();
  }

  /**
   * Open the login dialog from the header entry point (idempotent). Desktop opens it
   * directly from the text CTA; the mobile layout opens the account-icon menu first and
   * picks its "log in" item — see LOGIN.mobileLoginEntry.
   */
  async open(): Promise<void> {
    if (await this.dialog.isVisible().catch(() => false)) return;
    if (await this.headerCta.isVisible().catch(() => false)) {
      await allureStep('Open cellular login dialog', () => this.headerCta.click());
    } else {
      await allureStep('Open header account menu', () => this.headerMenuIcon.click());
      await allureStep('Choose "log in" from the menu', () =>
        this.page.getByRole('menuitem', { name: LOGIN.mobileLoginEntry }).click());
    }
    await this.heading.waitFor({ state: 'visible', timeout: 15_000 });
  }

  /** Type a cellular number (fill, not type — the field has an input mask). */
  async enterMobileNumber(value: string): Promise<void> {
    await allureStep(`Enter mobile number "${value}"`, () => this.phoneField.fill(value));
  }

  /** Close the dialog. */
  async close(): Promise<void> {
    await allureStep('Close login dialog', () => this.closeButton.click());
  }

  /**
   * Request an OTP (clicks "send code"). TRIGGERS A REAL DEV OTP SEND — call only from an
   * opt-in, rate-limit-aware test, never from the default UI-state checks.
   */
  async requestOtp(): Promise<void> {
    await allureStep('Request verification code', () => this.sendCodeButton.click());
  }
}
