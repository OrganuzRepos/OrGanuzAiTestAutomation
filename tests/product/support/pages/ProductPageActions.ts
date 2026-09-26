import type { Locator, Page } from '@playwright/test';
import { allureStep } from '../../../../src/utils/allure';

/** Shared locator fallbacks used by the product sub-pages. */
export class ProductPageActions {
  constructor(private readonly page: Page) {}

  async fillFirstVisible(testIds: readonly string[], value: string): Promise<void> {
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

  async fillIfVisible(locator: Locator, value: string): Promise<boolean> {
    if (!(await locator.first().isVisible().catch(() => false))) return false;
    await allureStep('Fill field', () => locator.first().fill(value));
    return true;
  }

  async clickFirstVisible(locators: readonly Locator[]): Promise<void> {
    await allureStep('Click first visible element', async () => {
      const target = await this.firstVisible(locators);
      await target.click();
    });
  }

  async clickIfVisible(locators: readonly Locator[]): Promise<boolean> {
    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        await allureStep('Click element', () => first.click());
        return true;
      }
    }
    return false;
  }

  async firstVisible(locators: readonly Locator[]): Promise<Locator> {
    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) return first;
    }
    throw new Error('No visible product app locator matched the expected flow step.');
  }
}
