import { expect, type Page } from '@playwright/test';
import type {
  ProductPersona,
  PropertyCharacterizationData,
} from '../../../../src/types/productMatrix.types';
import { allureStep } from '../../../../src/utils/allure';
import type { ProductRuntimeIds } from '../product-page.types';
import { ProductPageActions } from './ProductPageActions';
import { ProductRuntimeIdsReader } from './ProductRuntimeIdsReader';

/** Funding choice, quotation/results navigation, downloads, and access checks. */
export class ProductResultsPage {
  constructor(
    private readonly page: Page,
    private readonly actions: ProductPageActions,
    private readonly runtimeIds: ProductRuntimeIdsReader,
  ) {}

  async answerFunding(data: PropertyCharacterizationData): Promise<ProductRuntimeIds> {
    const choice = data.wantFinancingOffer
      ? /yes|interested|כן|מעוניין/i
      : /no|not now|לא/i;
    await this.actions.clickFirstVisible([
      this.page.getByTestId(data.wantFinancingOffer ? 'financing-yes' : 'financing-no'),
      this.page.getByRole('radio', { name: choice }),
      this.page.getByRole('button', { name: choice }),
    ]);
    await this.actions.clickFirstVisible([
      this.page.getByTestId('funding-next'),
      this.page.getByRole('button', { name: /next|continue|finish|סיום|המשך/i }),
    ]);
    await expect(this.page).toHaveURL(/quotation|quote|result|summary|pricing/i);
    return this.runtimeIds.capture();
  }

  async expectPostFundingDestination(persona: ProductPersona): Promise<void> {
    const destination = persona.expectedPostFundingDestination === 'quotations'
      ? /quotation|quote|הצעות|הצעת מחיר/i
      : /result|summary|תוצאות|סיכום/i;
    await expect(this.page).toHaveURL(destination);
  }

  async openQuotationsFromResults(): Promise<void> {
    await this.actions.clickFirstVisible([
      this.page.getByTestId('continue-to-quotations'),
      this.page.getByRole('link', { name: /quotation|quote|הצעות|הצעת מחיר/i }),
      this.page.getByRole('button', { name: /quotation|quote|הצעות|הצעת מחיר/i }),
    ]);
    await expect(this.page).toHaveURL(/quotation|quote|הצעות/i);
  }

  async downloadOwnQuotation(): Promise<void> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.actions.clickFirstVisible([
      this.page.getByTestId('download-own-quotation'),
      this.page.getByRole('link', { name: /download|quotation|הורדה|הצעת מחיר/i }),
      this.page.getByRole('button', { name: /download|quotation|הורדה|הצעת מחיר/i }),
    ]);
    await downloadPromise;
  }

  async expectAccessBlocked(path: string): Promise<void> {
    await allureStep(`Navigate to ${path}`, () => this.page.goto(path));
    await expect(
      this.page
        .getByText(/forbidden|unauthorized|access denied|403|אין הרשאה|גישה נדחתה/i)
        .first(),
    ).toBeVisible();
  }
}
