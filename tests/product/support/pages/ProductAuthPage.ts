import { expect, type Locator, type Page } from '@playwright/test';
import { LoginDialog, ProductSession } from '../../../../src/pages/product';
import { allureStep } from '../../../../src/utils/allure';
import { unlockProductEnvironment } from '../env-gate';
import { APP_UNAVAILABLE_REASON, AppUnavailableError, OtpUnavailableError } from '../errors';
import type { ProductCredentials, ProductRuntimeIds } from '../product-page.types';
import { ProductPageActions } from './ProductPageActions';
import { ProductRuntimeIdsReader } from './ProductRuntimeIdsReader';
import { ProductShellPage } from './ProductShellPage';

/** Product authentication, OTP entry, and persisted-session detection. */
export class ProductAuthPage {
  readonly loginEntryPoint: Locator;
  readonly loginDialog: LoginDialog;

  private readonly session: ProductSession;

  constructor(
    private readonly page: Page,
    private readonly shell: ProductShellPage,
    private readonly actions: ProductPageActions,
    private readonly runtimeIds: ProductRuntimeIdsReader,
    loginDialog: LoginDialog,
    session: ProductSession,
  ) {
    this.loginDialog = loginDialog;
    this.loginEntryPoint = this.loginDialog.entryButton;
    this.session = session;
  }

  async login(credentials: ProductCredentials): Promise<ProductRuntimeIds> {
    if (!/\/calculator\//i.test(this.page.url())) {
      await allureStep('Navigate to product login', () =>
        this.page.goto(process.env.PRODUCT_LOGIN_PATH ?? '/'));
      await unlockProductEnvironment(this.page);
    }

    if (!(await this.shell.isLoaded())) {
      throw new AppUnavailableError(APP_UNAVAILABLE_REASON);
    }
    if (await this.isLoggedIn()) return this.runtimeIds.capture();

    await this.openLoginDialog();
    if (credentials.phone) {
      await this.loginWithPhone(credentials.phone, credentials.otpCode);
    } else if (credentials.email && credentials.password) {
      await this.loginWithEmail(credentials.email, credentials.password);
    } else {
      throw new Error('Product login requires either phone credentials or email/password credentials.');
    }

    await this.actions.clickFirstVisible([
      this.page.getByTestId('login-submit'),
      this.page.getByRole('button', { name: /log in|sign in|login|כניסה|התחברות/i }),
      this.page.getByRole('button', { name: /continue|המשך/i }),
    ]).catch(() => undefined);
    await this.page.waitForLoadState('domcontentloaded');

    if (credentials.phone && !(await this.session.waitForPersistedToken(8_000))) {
      throw new OtpUnavailableError(
        `Login did not authenticate ${credentials.phone} — likely dev OTP rate-limit cooldown.`,
      );
    }
    return this.runtimeIds.capture();
  }

  async isAuthenticated(): Promise<boolean> {
    await this.page.waitForLoadState('domcontentloaded');
    return this.isLoggedIn();
  }

  async isLoggedIn(): Promise<boolean> {
    if (await this.session.hasPersistedToken()) return true;
    return this.page
      .getByRole('button', { name: /בעל נכס|יועץ|קבלן|חברת|יזם/ })
      .first()
      .waitFor({ state: 'visible', timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
  }

  async openLoginDialog(): Promise<void> {
    if (await this.loginDialog.phoneField.isVisible().catch(() => false)) return;
    await this.loginDialog.open();
    await this.loginDialog.phoneField.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async fillOtpCode(code: string): Promise<void> {
    const dialog = this.page.getByRole('dialog');
    const scope = (await dialog.count()) ? dialog : this.page.locator('body');
    await this.page
      .getByRole('heading', { name: /הזנת קוד|verification|קוד אימות|enter.*code/i })
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    await scope.getByRole('textbox').nth(1).waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);

    const boxes = scope.getByRole('textbox');
    const count = await boxes.count();
    if (count > 1) {
      const digits = code.split('');
      for (let index = 0; index < Math.min(count, digits.length); index++) {
        await allureStep(`Fill OTP digit ${index + 1}`, () => boxes.nth(index).fill(digits[index]));
      }
      return;
    }
    await this.actions.fillFirstVisible(['otp', 'code', 'verification-code'], code);
  }

  private async loginWithPhone(phone: string, otpCode?: string): Promise<void> {
    const phoneField = await this.actions.firstVisible([
      this.page.getByRole('textbox', { name: /טלפון|נייד|phone|mobile/i }),
      this.page.getByTestId('phone'),
    ]);
    await allureStep('Fill phone number', () => phoneField.fill(phone));

    const sendCode = this.page
      .getByRole('button', { name: /שלחו לי קוד|send.*code|verification|otp/i })
      .first();
    const otpHeading = this.page
      .getByRole('heading', { name: /הזנת קוד|verification|קוד אימות|enter.*code/i })
      .first();
    await expect(sendCode).toBeEnabled({ timeout: 10_000 });
    await allureStep('Click send verification code', () => sendCode.click());

    try {
      await otpHeading.waitFor({ state: 'visible', timeout: 12_000 });
    } catch {
      await this.actions.clickFirstVisible([
        this.page.getByRole('button', { name: /שלחו שנית|resend|send.*again/i }),
        sendCode,
      ]).catch(() => undefined);
      try {
        await otpHeading.waitFor({ state: 'visible', timeout: 15_000 });
      } catch {
        throw new OtpUnavailableError(
          `OTP step never rendered for ${phone} — dev OTP rate-limit cooldown.`,
        );
      }
    }

    if (otpCode) {
      await this.fillOtpCode(otpCode);
      await this.actions.clickFirstVisible([
        this.page.getByTestId('verify-otp'),
        this.page.getByRole('button', { name: /אישור והתחברות|verify|continue|login|אימות|המשך|כניסה/i }),
      ]);
    }
  }

  private async loginWithEmail(email: string, password: string): Promise<void> {
    await this.actions.fillFirstVisible(['email', 'user'], email);
    await this.actions.fillFirstVisible(['password'], password);
    await this.actions.clickFirstVisible([
      this.page.getByTestId('login-submit'),
      this.page.getByRole('button', { name: /log in|sign in|login|כניסה|התחברות/i }),
    ]);
  }
}
