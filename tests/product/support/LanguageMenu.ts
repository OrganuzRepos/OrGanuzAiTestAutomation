import { Page } from '@playwright/test';
import { productLangLabel, ProductLocale } from '../../../src/i18n/product';
import { allureStep } from '../../../src/utils/allure';

/**
 * Sub-page-object for the product app's header language menu. The trigger button's
 * accessible name is the CURRENT language label (e.g. "עברית"); opening it exposes the
 * other language as an option. Encapsulates the switch + persistence so ProductAppPage
 * (and any English spec) doesn't repeat the menu mechanics. See organuz-product-en.
 */
export class LanguageMenu {
  constructor(private readonly page: Page) {}

  /** The current UI language read from `<html lang>` ('he' | 'en'). */
  async current(): Promise<string> {
    return (await this.page.locator('html').getAttribute('lang')) ?? '';
  }

  /** Switch to the given language via the menu; idempotent (no-op when already there). */
  async switchTo(locale: ProductLocale): Promise<void> {
    if ((await this.current()) === locale) return;
    // Trigger shows the *current* language; the other locale is the menu option to pick.
    const other: ProductLocale = locale === 'en' ? 'he' : 'en';
    const trigger = this.page.getByRole('button', { name: productLangLabel[other] }).first();
    // Mobile: the language control lives inside the header account-icon menu (a nameless
    // button in the print-hidden header bar), so open that first when the trigger is hidden.
    if (!(await trigger.isVisible().catch(() => false))) {
      await allureStep('Open header account menu (mobile)', () =>
        this.page.locator('.print_hide').getByRole('button').first().click());
    }
    await allureStep(`Open language menu (${productLangLabel[other]})`, () => trigger.click());
    await allureStep(`Select language ${productLangLabel[locale]}`, () =>
      this.page
        .getByRole('menuitem', { name: productLangLabel[locale] })
        .or(this.page.getByRole('option', { name: productLangLabel[locale] }))
        .or(this.page.getByText(new RegExp(`^${productLangLabel[locale]}$`)))
        .first()
        .click());
    await this.page.locator(`html[lang="${locale}"]`).waitFor({ state: 'attached', timeout: 15_000 });
  }
}
