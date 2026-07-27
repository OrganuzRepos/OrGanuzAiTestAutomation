import { expect, type Locator, type Page } from '@playwright/test';
import { LoginDialog } from '../../../../src/pages/product';
import { productChrome } from '../../../../src/i18n/product';
import { allureStep } from '../../../../src/utils/allure';

/** Signed-in account menu, personal-area navigation, and logout. */
export class ProductAccountPage {
  readonly userMenuButton: Locator;

  constructor(
    private readonly page: Page,
    private readonly loginDialog: LoginDialog,
  ) {
    this.userMenuButton = page
      .getByRole('button', { name: /בעל נכס|יועץ|קבלן|חברת|יזם/ })
      .first();
  }

  async openUserMenu(): Promise<void> {
    await allureStep('Open user menu', () => this.userMenuButton.click());
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
