import { expect, Locator, Page } from '@playwright/test';
import {
  PROPERTY_TYPE_LABELS,
  type ProductPersona,
  type PropertyCharacterizationData,
} from '../matrix/e2e-matrix.data';
import { unlockProductEnvironment } from './env-gate';
import { OtpUnavailableError, AppUnavailableError, APP_UNAVAILABLE_REASON } from './errors';
import { LanguageMenu } from './LanguageMenu';
import { WIZARD } from './steps/wizardControls';
import { anyLoginEntry, productChrome } from '../../../src/i18n/product';
import { allureStep } from '../../../src/utils/allure';

// Re-export so existing importers (the matrix spec) can keep importing from here.
export { OtpUnavailableError, AppUnavailableError, APP_UNAVAILABLE_REASON } from './errors';

export interface ProductCredentials {
  readonly phone?: string;
  readonly otpCode?: string;
  readonly email?: string;
  readonly password?: string;
}

/** Details for a fresh self-serve property-owner ("בעלי נכסים") registration. */
export interface NewCustomerAccount {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly email: string;
}

export interface ProductRuntimeIds {
  projectId?: string;
  quotationId?: string;
  entrepreneurQuotationId?: string;
  token?: string;
}

export class ProductAppPage {
  /** Header language-menu sub-page-object (switch he↔en + read current language). */
  private readonly language: LanguageMenu;

  constructor(private readonly page: Page) {
    this.language = new LanguageMenu(page);
  }

  async login(credentials: ProductCredentials): Promise<ProductRuntimeIds> {
    // Skip the (re-)navigation when the calculator is already open — e.g. product-setup
    // calls openCalculator() first. Once the dev gate has been unlocked, a fresh goto('/')
    // lands on a bare '/' that no longer auto-routes to /calculator, so the shell guard
    // below would wrongly report the backend as down. Only navigate + unlock when we are
    // not already on a calculator route (standalone loginAs, fresh page).
    if (!/\/calculator\//i.test(this.page.url())) {
      await allureStep('Navigate to product login', () =>
        this.page.goto(process.env.PRODUCT_LOGIN_PATH ?? '/'));
      // DEV/TEST sit behind a shared password gate before the app loads (no-op on prod).
      await unlockProductEnvironment(this.page);
    }

    // The calculator shell must render; if only the header loads, the backend is down —
    // surface it so the caller skips instead of failing on a missing phone field etc.
    if (!(await this.isAppShellLoaded())) {
      throw new AppUnavailableError(APP_UNAVAILABLE_REASON);
    }

    // Idempotent: a persisted session ("זכרו אותי") may already be authenticated.
    if (await this.isLoggedIn()) {
      return this.captureRuntimeIds();
    }
    await this.openLoginDialogIfNeeded();

    if (credentials.phone) {
      const phoneField = await this.firstVisible([
        this.page.getByRole('textbox', { name: /טלפון|נייד|phone|mobile/i }),
        this.page.getByTestId('phone'),
      ]);
      // fill() (not pressSequentially) — the phone input has a mask that mangles
      // char-by-char typing; a single fill sets a valid number and enables send.
      await allureStep('Fill phone number', () => phoneField.fill(credentials.phone!));

      const sendCode = this.page
        .getByRole('button', { name: /שלחו לי קוד|send.*code|verification|otp/i })
        .first();
      const otpHeading = this.page
        .getByRole('heading', { name: /הזנת קוד|verification|קוד אימות|enter.*code/i })
        .first();
      await expect(sendCode).toBeEnabled({ timeout: 10_000 });
      await allureStep('Click send verification code', () => sendCode.click());

      // The code step is occasionally slow/dropped — resend once if it doesn't render.
      try {
        await otpHeading.waitFor({ state: 'visible', timeout: 12_000 });
      } catch {
        await this.clickFirstVisible([
          this.page.getByRole('button', { name: /שלחו שנית|resend|send.*again/i }),
          sendCode,
        ]).catch(() => undefined);
        try {
          await otpHeading.waitFor({ state: 'visible', timeout: 15_000 });
        } catch {
          // Dev limits OTP sends per phone; when a number is hammered (exploration +
          // reruns of the other product specs) the code step never renders until a
          // cooldown. Environmental — surface it so the caller can skip. See the skill.
          throw new OtpUnavailableError(
            `OTP step never rendered for ${credentials.phone} — dev OTP rate-limit cooldown.`,
          );
        }
      }

      if (credentials.otpCode) {
        await this.fillOtpCode(credentials.otpCode);
        await this.clickFirstVisible([
          this.page.getByTestId('verify-otp'),
          this.page.getByRole('button', { name: /אישור והתחברות|verify|continue|login|אימות|המשך|כניסה/i }),
        ]);
      }
    } else if (credentials.email && credentials.password) {
      await this.fillFirstVisible(['email', 'user'], credentials.email);
      await this.fillFirstVisible(['password'], credentials.password);
      await this.clickFirstVisible([
        this.page.getByTestId('login-submit'),
        this.page.getByRole('button', { name: /log in|sign in|login|כניסה|התחברות/i }),
      ]);
    } else {
      throw new Error('Product login requires either phone credentials or email/password credentials.');
    }

    await this.clickFirstVisible([
      this.page.getByTestId('login-submit'),
      this.page.getByRole('button', { name: /log in|sign in|login|כניסה|התחברות/i }),
      this.page.getByRole('button', { name: /continue|המשך/i }),
    ]).catch(() => undefined);
    // Avoid networkidle: the calculator's embedded map iframe keeps the network busy.
    await this.page.waitForLoadState('domcontentloaded');

    // Verify the session is actually authenticated. When phone auth was used but the app
    // still shows the login entry point, the dev OTP rate-limit (or a dropped code step)
    // prevented sign-in. Surface it so the caller skips, rather than returning a half-
    // logged-in session that fails a later identity/nav assertion confusingly.
    if (credentials.phone && !(await this.isLoggedIn())) {
      throw new OtpUnavailableError(
        `Login did not authenticate ${credentials.phone} — likely dev OTP rate-limit cooldown.`,
      );
    }

    return this.captureRuntimeIds();
  }

  // --- Registration ---------------------------------------------------------
  // Property owners self-register in-app (the flow below); solar companies and
  // entrepreneurs (company/consultant) are not self-serve — their "הירשמו כאן"
  // opens the marketing-site contact/lead form instead (openSolarCompanyRegistration).

  /**
   * Open the property-owner ("הרשמת בעלי נכסים") self-registration form. The login
   * dialog lists two "הירשמו כאן" CTAs — [0] property owners, [1] solar company /
   * entrepreneur; this opens the first. Throws AppUnavailableError if the shell (hence
   * the login dialog) never renders, so callers skip rather than fail.
   */
  async openCustomerRegistration(): Promise<void> {
    if (!(await this.isAppShellLoaded())) {
      throw new AppUnavailableError(APP_UNAVAILABLE_REASON);
    }
    await this.openLoginDialogIfNeeded();
    await allureStep('Open property-owner registration', () =>
      this.page.getByRole('button', { name: 'הירשמו כאן' }).first().click());
    await expect(this.page.getByRole('heading', { name: 'הרשמת בעלי נכסים' })).toBeVisible({ timeout: 15_000 });
  }

  /** The property-owner registration submit button ("הרשמה והתחברות"). */
  registrationSubmitButton(): Locator {
    return this.page.getByRole('button', { name: 'הרשמה והתחברות' });
  }

  /** Required terms consent checkbox ("תקנון האתר"). */
  registrationTermsCheckbox(): Locator {
    return this.page.getByRole('checkbox').first();
  }

  /** Optional marketing/updates consent checkbox; it must not gate registration. */
  registrationOptionalConsentCheckbox(): Locator {
    return this.page.getByRole('checkbox').nth(1);
  }

  /** Fill the four registration text fields (name, phone, email) — not the consent boxes. */
  async fillCustomerRegistrationFields(account: NewCustomerAccount): Promise<void> {
    await allureStep('Fill registration first name', () =>
      this.page.getByRole('textbox', { name: 'שם פרטי' }).fill(account.firstName));
    await allureStep('Fill registration last name', () =>
      this.page.getByRole('textbox', { name: 'שם משפחה' }).fill(account.lastName));
    await allureStep('Fill registration phone', () =>
      this.page.getByRole('textbox', { name: 'טלפון נייד' }).fill(account.phone));
    await allureStep('Fill registration email', () =>
      this.page.getByRole('textbox', { name: 'דואר אלקטרוני' }).fill(account.email));
  }

  /** Tick the required terms consent ("תקנון האתר"); the first checkbox in the form. */
  async acceptRegistrationTerms(): Promise<void> {
    const terms = this.registrationTermsCheckbox();
    if (!(await terms.isChecked())) {
      await allureStep('Accept registration terms', () => terms.check());
    }
  }

  /**
   * Submit the filled registration, complete the OTP step (same 4-box code dialog as
   * login), and confirm the new session is authenticated. Throws OtpUnavailableError —
   * which callers turn into a skip — if the OTP step never renders or sign-in doesn't
   * take (dev OTP rate-limit / an already-registered phone).
   */
  async submitCustomerRegistration(otpCode: string): Promise<void> {
    await expect(this.registrationSubmitButton()).toBeEnabled({ timeout: 10_000 });
    await allureStep('Submit registration', () => this.registrationSubmitButton().click());

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

    await this.fillOtpCode(otpCode);
    await this.clickFirstVisible([
      this.page.getByTestId('verify-otp'),
      this.page.getByRole('button', { name: /אישור והתחברות|verify|continue|login|אימות|המשך|כניסה/i }),
    ]);
    await this.page.waitForLoadState('domcontentloaded');

    if (!(await this.isLoggedIn())) {
      throw new OtpUnavailableError(
        'Registration did not authenticate the new account — likely dev OTP rate-limit cooldown.',
      );
    }
  }

  /**
   * Open the solar-company / entrepreneur registration ("חברה סולארית? יזם סולארי?").
   * This is NOT a self-serve in-app form: it opens the marketing-site contact/lead form
   * (organuz.ai/#contact) in a new tab, which this returns for the caller to assert on.
   */
  async openSolarCompanyRegistration(): Promise<Page> {
    if (!(await this.isAppShellLoaded())) {
      throw new AppUnavailableError(APP_UNAVAILABLE_REASON);
    }
    await this.openLoginDialogIfNeeded();
    const popupPromise = this.page.waitForEvent('popup');
    await allureStep('Open solar-company registration', () =>
      this.page.getByRole('button', { name: 'הירשמו כאן' }).nth(1).click());
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    return popup;
  }

  /**
   * Enter a verification code. The dev/test login uses N single-digit boxes
   * (one textbox per digit); other UIs may use a single field. Handles both.
   */
  private async fillOtpCode(code: string): Promise<void> {
    const dialog = this.page.getByRole('dialog');
    const scope = (await dialog.count()) ? dialog : this.page.locator('body');

    // The code-entry step renders after "send code" — wait for it before reading fields.
    await this.page
      .getByRole('heading', { name: /הזנת קוד|verification|קוד אימות|enter.*code/i })
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    // Multi-box OTP: wait for at least a second digit box to appear.
    await scope.getByRole('textbox').nth(1).waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);

    const boxes = scope.getByRole('textbox');
    const count = await boxes.count();

    if (count > 1) {
      const digits = code.split('');
      for (let i = 0; i < Math.min(count, digits.length); i++) {
        await allureStep(`Fill OTP digit ${i + 1}`, () => boxes.nth(i).fill(digits[i]));
      }
      return;
    }

    await this.fillFirstVisible(['otp', 'code', 'verification-code'], code);
  }

  /**
   * Step 1 of the dev calculator wizard: choose property type + address, confirm
   * the auto-located property, and wait for the satellite roof scan to produce a
   * roof id (…/calculator/roof/<roofId>/marking). See the organuz-product-e2e skill.
   */
  async createProject(data: PropertyCharacterizationData): Promise<ProductRuntimeIds> {
    // Property type (Hebrew label button) then address autocomplete.
    await this.selectPropertyType(data.propertyType);
    const address = this.page.getByRole('combobox').first();
    await allureStep('Focus address field', () => address.click());
    // Type character-by-character so the address autocomplete fires its key handlers.
    await allureStep(`Type address "${data.address}"`, () =>
      address.pressSequentially(data.address, { delay: 60 }));
    await this.page.getByRole('option').first().waitFor({ state: 'visible', timeout: 20_000 });
    await allureStep('Select first address suggestion', () =>
      this.page.getByRole('option').first().click());

    await this.clickPrimaryContinue(); // בוא נמשיך → /address/get-address
    await this.clickFirstVisible([
      this.page.getByRole('button', { name: WIZARD.confirmProperty }),
    ]);

    // Satellite scan runs, then routes to the roof-marking step with a runtime id.
    await this.page.getByText('טוען...').first().waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    await this.page.waitForURL(/\/roof\/[^/]+\/marking/i, { timeout: 45_000 });

    return this.captureRuntimeIds();
  }

  /** Click the wizard's primary "continue" button (בוא נמשיך) once it is enabled. */
  private async clickPrimaryContinue(): Promise<void> {
    const cont = this.page.getByRole('button', { name: WIZARD.continue }).last();
    await expect(cont).toBeEnabled({ timeout: 20_000 });
    await allureStep('Click primary continue', () => cont.click());
  }

  /**
   * Wizard steps 2–3: the AI auto-detects the roof boundary (סימון השטח) and lets
   * you skip obstacle marking (placement-elements). Advances both and stops at the
   * roof-type step (…/roof/<id>/type), which requires manual map drawing.
   * Returns the runtime ids parsed from the URL path.
   */
  async advanceAutoDetectedRoof(): Promise<ProductRuntimeIds> {
    await this.clickPrimaryContinue(); // auto-detected boundary → placement-elements
    await this.page.waitForURL(/\/roof\/[^/]+\/placement-elements/i, { timeout: 30_000 });
    await this.clickPrimaryContinue(); // skip obstacles → roof type
    await this.page.waitForURL(/\/roof\/[^/]+\/type/i, { timeout: 30_000 });
    return this.captureRoofRuntimeIds();
  }

  /** Parse the project + roof ids out of the calculator URL path. */
  captureRoofRuntimeIds(): ProductRuntimeIds {
    const match = this.page.url().match(/\/([^/]+)\/calculator\/roof\/([^/]+)\//i);
    return { projectId: match?.[1], quotationId: match?.[2] };
  }

  async characterizeRoof(data: PropertyCharacterizationData): Promise<ProductRuntimeIds> {
    await this.markPolygons(data);
    await this.markRoofSurfaces(data);
    await this.markMinimumQuotableRoof(data.minimumPanelCount);
    await this.clickFirstVisible([
      this.page.getByTestId('roof-next'),
      this.page.getByRole('button', { name: /calculate|next|continue|חשב|המשך/i }),
    ]);
    await this.expectRoofCalculationDestination(data);

    return this.captureRuntimeIds();
  }

  async expectInsufficientPanelsModal(): Promise<void> {
    await expect(this.page.getByText(/not enough panels|insufficient panels|פחות מ.?5|אין מספיק פאנלים/i).first()).toBeVisible();
  }

  async answerFunding(data: PropertyCharacterizationData): Promise<ProductRuntimeIds> {
    const choice = data.wantFinancingOffer
      ? /yes|interested|כן|מעוניין/i
      : /no|not now|לא/i;

    await this.clickFirstVisible([
      this.page.getByTestId(data.wantFinancingOffer ? 'financing-yes' : 'financing-no'),
      this.page.getByRole('radio', { name: choice }),
      this.page.getByRole('button', { name: choice }),
    ]);
    await this.clickFirstVisible([
      this.page.getByTestId('funding-next'),
      this.page.getByRole('button', { name: /next|continue|finish|סיום|המשך/i }),
    ]);
    await expect(this.page).toHaveURL(/quotation|quote|result|summary|pricing/i);

    return this.captureRuntimeIds();
  }

  async expectPostFundingDestination(persona: ProductPersona): Promise<void> {
    const destination = persona.expectedPostFundingDestination === 'quotations'
      ? /quotation|quote|הצעות|הצעת מחיר/i
      : /result|summary|תוצאות|סיכום/i;

    await expect(this.page).toHaveURL(destination);
  }

  async openQuotationsFromResults(): Promise<void> {
    await this.clickFirstVisible([
      this.page.getByTestId('continue-to-quotations'),
      this.page.getByRole('link', { name: /quotation|quote|הצעות|הצעת מחיר/i }),
      this.page.getByRole('button', { name: /quotation|quote|הצעות|הצעת מחיר/i }),
    ]);
    await expect(this.page).toHaveURL(/quotation|quote|הצעות/i);
  }

  async downloadOwnQuotation(): Promise<void> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.clickFirstVisible([
      this.page.getByTestId('download-own-quotation'),
      this.page.getByRole('link', { name: /download|quotation|הורדה|הצעת מחיר/i }),
      this.page.getByRole('button', { name: /download|quotation|הורדה|הצעת מחיר/i }),
    ]);
    await downloadPromise;
  }

  async expectAccessBlocked(path: string): Promise<void> {
    await allureStep(`Navigate to ${path}`, () => this.page.goto(path));
    await expect(this.page.getByText(/forbidden|unauthorized|access denied|403|אין הרשאה|גישה נדחתה/i).first()).toBeVisible();
  }

  captureRuntimeIds(): ProductRuntimeIds {
    const url = new URL(this.page.url());

    return {
      projectId: this.findRuntimeValue(url, ['projectId', 'project', 'pid']),
      quotationId: this.findRuntimeValue(url, ['quotationId', 'quotation', 'qid']),
      entrepreneurQuotationId: this.findRuntimeValue(url, ['entrepreneurQuotationId']),
      token: this.findRuntimeValue(url, ['token']),
    };
  }

  private async fillFirstVisible(testIds: readonly string[], value: string): Promise<void> {
    const locators = testIds.flatMap((testId) => [
      this.page.getByTestId(testId),
      this.page.getByLabel(new RegExp(testId.replace('-', '.*'), 'i')),
      this.page.locator(`input[name="${testId}"]`),
    ]);

    await allureStep('Fill first visible field', async () => {
      const target = await this.firstVisible(locators);
      await target.fill(value);
    });
  }

  /** The header user-menu button, whose accessible name is "<name>, <role>". */
  userMenuButton(): Locator {
    return this.page.getByRole('button', { name: /בעל נכס|יועץ|קבלן|חברת|יזם/ }).first();
  }

  /** Open the header user menu (exposes "איזור אישי" and "התנתק"). */
  async openUserMenu(): Promise<void> {
    await allureStep('Open user menu', () => this.userMenuButton().click());
  }

  /** Open the user menu and go to the personal area (…/pricing/my-offers). */
  async openPersonalArea(): Promise<void> {
    await this.openUserMenu();
    await allureStep('Open personal area', () =>
      this.page.getByRole('menuitem', { name: productChrome.personalArea }).click());
    await this.page.waitForURL(/\/pricing\//i, { timeout: 20_000 });
  }

  /** Click a personal-area sidebar entry by its Hebrew label (e.g. "מחירון קבלני"). */
  async openSidebarEntry(name: string | RegExp): Promise<void> {
    await allureStep(`Open sidebar entry "${name}"`, () =>
      this.page.getByRole('button', { name }).first().click());
  }

  /** Open the user menu and log out. */
  async logout(): Promise<void> {
    await this.openUserMenu();
    await allureStep('Log out', () =>
      this.page.getByRole('menuitem', { name: productChrome.logout }).click());
  }

  /**
   * Assert the app is signed out: back on the public calculator with the login
   * entry point available. After logout the login dialog sometimes auto-opens
   * (heading "התחברות") and sometimes only the "הרשמה / כניסה" CTA shows — accept either.
   */
  async expectLoggedOut(): Promise<void> {
    await expect(this.page).toHaveURL(/\/calculator\//i);
    await expect(
      this.page
        .getByRole('button', { name: /הרשמה\s*\/\s*כניסה|הרשמה/ })
        .or(this.page.getByRole('heading', { name: 'התחברות' }))
        .first(),
    ).toBeVisible();
  }

  /**
   * True when the calculator shell has rendered (property-type buttons or the step
   * tracker). When the backend is down the app shows only its header, so this stays
   * false — callers treat that as an environmental outage and skip. The header's
   * `הרשמה / כניסה` / `עברית` render even when the backend is down, so they are NOT a
   * reliable signal; the calculator content is.
   */
  async isAppShellLoaded(): Promise<boolean> {
    const shell = this.page
      .getByRole('button', { name: /בית פרטי/ })
      .or(this.page.getByRole('list', { name: WIZARD.stepTrackerList }))
      .first();
    return shell.isVisible({ timeout: 15_000 }).catch(() => false);
  }

  /** The current UI language of the product app, read from `<html lang>` ('he' | 'en'). */
  async currentLanguage(): Promise<string> {
    return this.language.current();
  }

  /**
   * Switch the product app UI to English through the header language menu (delegated to
   * the LanguageMenu sub-page-object). Idempotent — a no-op when already English. The
   * choice persists in `localStorage["organuz_selected_language"]`, so it survives reloads
   * within the run. See the organuz-product-en skill.
   */
  async switchToEnglish(): Promise<void> {
    await this.language.switchTo('en');
  }

  /**
   * True when the app is authenticated (the public login entry point is gone). Public so
   * callers can gate on a restored storageState session without the page object making
   * test-lifecycle decisions itself.
   */
  async isAuthenticated(): Promise<boolean> {
    await this.page.waitForLoadState('domcontentloaded');
    return this.isLoggedIn();
  }

  /** True when the app is already authenticated (login entry point is gone). */
  private async isLoggedIn(): Promise<boolean> {
    // Matches the signed-out entry point in either language: Hebrew "הרשמה / כניסה"
    // and English "Login / Register" (centralized in the product i18n dictionary).
    const loginEntry = this.page.getByRole('button', { name: anyLoginEntry }).first();
    // Give the header a moment to render, then treat "no login button" as logged in.
    const loginVisible = await loginEntry.isVisible({ timeout: 4_000 }).catch(() => false);
    return !loginVisible;
  }

  private async openLoginDialogIfNeeded(): Promise<void> {
    const loginInput = this.page.getByLabel(/phone|mobile|טלפון|נייד|email|דוא/i).first();
    if (await loginInput.isVisible().catch(() => false)) {
      return;
    }

    await this.clickFirstVisible([
      this.page.getByTestId('login-open'),
      this.page.getByRole('button', { name: /login|sign in|register|כניסה|התחברות|הרשמה/i }),
      this.page.getByRole('link', { name: /login|sign in|register|כניסה|התחברות|הרשמה/i }),
    ]);
  }

  private async selectPropertyType(propertyType: PropertyCharacterizationData['propertyType']): Promise<void> {
    const label = PROPERTY_TYPE_LABELS[propertyType];
    // Wait for the property-type buttons to render after login before clicking.
    const button = this.page.getByRole('button', { name: new RegExp(label, 'i') }).first();
    await button.waitFor({ state: 'visible', timeout: 20_000 });
    await allureStep(`Select property type "${label}"`, () => button.click());
  }

  private async selectArena(data: PropertyCharacterizationData): Promise<void> {
    if (data.arenaType === 'ARENA_TYPE_RAMOT') {
      await this.clickIfVisible([
        this.page.getByTestId('arena-ramot'),
        this.page.getByRole('button', { name: /רמות|ramot/i }),
        this.page.getByRole('link', { name: /רמות|ramot/i }),
      ]);
      return;
    }

    await this.clickIfVisible([
      this.page.getByTestId('arena-main'),
      this.page.getByRole('button', { name: /זירה מרכזית|main arena/i }),
      this.page.getByRole('link', { name: /זירה מרכזית|main arena/i }),
    ]);
  }

  private async markPolygons(data: PropertyCharacterizationData): Promise<void> {
    for (const polygon of data.polygons) {
      await this.clickIfVisible([
        this.page.getByTestId(`polygon-${polygon}`),
        this.page.getByRole('button', { name: new RegExp(polygon.replace('-', '.*'), 'i') }),
      ]);
    }
  }

  private async markRoofSurfaces(data: PropertyCharacterizationData): Promise<void> {
    if (data.skipsObjectAndRoofSteps) {
      return;
    }

    for (const surface of data.roofSurfaces) {
      await this.clickIfVisible([
        this.page.getByTestId(`roof-surface-${surface}`),
        this.page.getByRole('button', { name: roofSurfaceName(surface) }),
        this.page.getByRole('radio', { name: roofSurfaceName(surface) }),
      ]);
    }
  }

  private async markMinimumQuotableRoof(panelCount: number): Promise<void> {
    await this.fillIfVisible(this.page.getByTestId('panel-count'), String(panelCount));
    await this.fillIfVisible(this.page.getByLabel(/panel|פאנל/i), String(panelCount));
  }

  private async expectRoofCalculationDestination(data: PropertyCharacterizationData): Promise<void> {
    if (data.panelMode === 'below-minimum') {
      await this.expectInsufficientPanelsModal();
      return;
    }

    await expect(
      this.page
        .getByTestId('financing-yes')
        .or(this.page.getByTestId('financing-no'))
        .or(this.page.getByRole('radio', { name: /yes|interested|no|not now|כן|מעוניין|לא/i }))
        .or(this.page.getByRole('button', { name: /yes|interested|no|not now|כן|מעוניין|לא/i }))
        .first(),
    ).toBeVisible({ timeout: 45_000 });
  }

  private async fillIfVisible(locator: Locator, value: string): Promise<boolean> {
    if (!(await locator.first().isVisible().catch(() => false))) {
      return false;
    }

    await allureStep('Fill field', () => locator.first().fill(value));
    return true;
  }

  private async clickFirstVisible(locators: readonly Locator[]): Promise<void> {
    await allureStep('Click first visible element', async () => {
      const target = await this.firstVisible(locators);
      await target.click();
    });
  }

  private async clickIfVisible(locators: readonly Locator[]): Promise<boolean> {
    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        await allureStep('Click element', () => first.click());
        return true;
      }
    }

    return false;
  }

  private async firstVisible(locators: readonly Locator[]): Promise<Locator> {
    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        return first;
      }
    }

    throw new Error('No visible product app locator matched the expected flow step.');
  }

  private findRuntimeValue(url: URL, keys: readonly string[]): string | undefined {
    for (const key of keys) {
      const value = url.searchParams.get(key);
      if (value) {
        return value;
      }
    }

    const match = url.pathname.match(/\/(?:projects?|quotations?|quotes?)\/([^/?#]+)/i);
    return match?.[1];
  }
}

function roofSurfaceName(surface: PropertyCharacterizationData['roofSurfaces'][number]): RegExp {
  const names: Record<PropertyCharacterizationData['roofSurfaces'][number], RegExp> = {
    concrete: /concrete|בטון/i,
    tiles: /tiles|רעפים/i,
    iscoverit: /iscoverit|איסכורית|איזכורית/i,
    parking: /parking|חניה/i,
    'sports-court': /sports|court|מגרש ספורט/i,
  };

  return names[surface];
}
