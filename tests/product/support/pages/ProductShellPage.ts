import type { Page } from '@playwright/test';
import { WIZARD } from '../../../../src/pages/product';
import { LanguageMenu } from '../LanguageMenu';

/** Calculator shell health and product-language controls. */
export class ProductShellPage {
  private readonly language: LanguageMenu;

  constructor(private readonly page: Page) {
    this.language = new LanguageMenu(page);
  }

  async isLoaded(): Promise<boolean> {
    const shell = this.page
      .getByRole('button', { name: /בית פרטי/ })
      .or(this.page.getByRole('list', { name: WIZARD.stepTrackerList }))
      .first();
    return shell
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
  }

  async currentLanguage(): Promise<string> {
    return this.language.current();
  }

  async switchToEnglish(): Promise<void> {
    await this.language.switchTo('en');
  }
}
