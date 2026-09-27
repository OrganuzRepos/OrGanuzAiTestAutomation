import { expect, type Locator, type Page } from '@playwright/test';
import { LoginDialog, PERSONAL_AREA } from '../../../../src/pages/product';
import { productChrome } from '../../../../src/i18n/product';
import { allureStep } from '../../../../src/utils/allure';

/** Signed-in account menu, personal-area navigation, and logout. */
export class ProductAccountPage {
  /**
   * The header account affordance, matching EITHER layout: the desktop text button
   * ("<name>, <role>") or the nameless mobile account icon. The product project runs at a
   * narrow 600x800 viewport where only the icon exists, so matching just the named button
   * would hang every personal-area action until the test timed out.
   */
  readonly userMenuButton: Locator;

  /** Desktop-only: the header button named "<name>, <role>". */
  private readonly namedUserButton: Locator;
  /**
   * Mobile-only: the nameless icons in the print-hidden header bar, one of which is the
   * account control. Confirmed live that WHICH one varies by page — the roof steps also
   * put a named "חזרה" there, the personal area a second nameless icon — so openUserMenu
   * clicks them in turn and keeps the one that actually opens the account menu rather
   * than betting on an index.
   */
  private readonly headerIcons: Locator;

  /** The account menu's entry, used as the signal that the menu actually opened. */
  private readonly personalAreaItem: Locator;

  constructor(
    private readonly page: Page,
    private readonly loginDialog: LoginDialog,
  ) {
    this.namedUserButton = page.getByRole('button', { name: PERSONAL_AREA.userMenuButton }).first();
    this.headerIcons = page.locator('.print_hide').getByRole('button').filter({ hasNotText: /\S/ });
    this.userMenuButton = this.namedUserButton.or(this.headerIcons.first());
    this.personalAreaItem = page.getByRole('menuitem', { name: productChrome.personalArea });
  }

  /**
   * Open the header account menu, whichever layout is rendered. Idempotent, and verified
   * by the menu's own content — at the product project's 600x800 viewport the named
   * "<name>, <role>" button does not exist at all, so a selector that only matched it
   * would hang until the test timed out.
   */
  async openUserMenu(): Promise<void> {
    if (await this.personalAreaItem.isVisible().catch(() => false)) return;

    if (await this.namedUserButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await allureStep('Open user menu', () => this.namedUserButton.click());
      await this.personalAreaItem.waitFor({ state: 'visible', timeout: 10_000 });
      return;
    }

    const count = await this.headerIcons.count();
    for (let index = 0; index < count; index += 1) {
      await allureStep(`Open user menu (header icon ${index + 1})`, () =>
        this.headerIcons.nth(index).click());
      if (await this.personalAreaItem.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await this.page.keyboard.press('Escape').catch(() => undefined);
    }
    throw new Error(
      `The header account menu did not open from any of the ${count} header icons — is the session signed in?`,
    );
  }

  async openPersonalArea(): Promise<void> {
    await this.openUserMenu();
    await allureStep('Open personal area', () =>
      this.page.getByRole('menuitem', { name: productChrome.personalArea }).click());
    await this.page.waitForURL(/\/pricing\//i, { timeout: 20_000 });
  }

  async openSidebarEntry(name: string | RegExp): Promise<void> {
    await allureStep(`Open sidebar entry "${name}"`, () =>
      this.page.getByRole('button', { name }).first().click());
  }

  async logout(): Promise<void> {
    await this.openUserMenu();
    await allureStep('Log out', () =>
      this.page.getByRole('menuitem', { name: productChrome.logout }).click());
  }

  async expectLoggedOut(): Promise<void> {
    await expect(this.page).toHaveURL(/\/calculator\//i);
    await expect(
      this.loginDialog.entryButton
        .or(this.page.getByRole('heading', { name: 'התחברות' }))
        .first(),
    ).toBeVisible();
  }
}
