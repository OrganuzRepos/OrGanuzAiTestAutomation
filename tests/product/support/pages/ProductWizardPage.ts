import { expect, type Page } from '@playwright/test';
import { PROPERTY_TYPE_LABELS } from '../../../../src/data/productMatrix.constants';
import { WIZARD } from '../../../../src/pages/product';
import type { PropertyCharacterizationData } from '../../../../src/types/productMatrix.types';
import { allureStep } from '../../../../src/utils/allure';
import type { ProductRuntimeIds } from '../product-page.types';
import { ProductPageActions } from './ProductPageActions';
import { ProductRuntimeIdsReader } from './ProductRuntimeIdsReader';

/** Characterization wizard, roof processing, funding, and quotation results. */
export class ProductWizardPage {
  constructor(
    private readonly page: Page,
    private readonly actions: ProductPageActions,
    private readonly runtimeIds: ProductRuntimeIdsReader,
  ) {}

  async createProject(data: PropertyCharacterizationData): Promise<ProductRuntimeIds> {
    await this.selectPropertyType(data.propertyType);
    const address = this.page.getByRole('combobox').first();
    await allureStep('Focus address field', () => address.click());
    await allureStep(`Type address "${data.address}"`, () =>
      address.pressSequentially(data.address, { delay: 60 }));
    await this.page.getByRole('option').first().waitFor({ state: 'visible', timeout: 20_000 });
    await allureStep('Select first address suggestion', () =>
      this.page.getByRole('option').first().click());

    await this.clickPrimaryContinue();
    await this.actions.clickFirstVisible([
      this.page.getByRole('button', { name: WIZARD.confirmProperty }),
    ]);
    await this.page.getByText('טוען...').first()
      .waitFor({ state: 'hidden', timeout: 45_000 })
      .catch(() => undefined);
    await this.page.waitForURL(/\/roof\/[^/]+\/marking/i, { timeout: 45_000 });
    return this.runtimeIds.capture();
  }

  async advanceAutoDetectedRoof(): Promise<ProductRuntimeIds> {
    await this.clickPrimaryContinue();
    await this.page.waitForURL(/\/roof\/[^/]+\/placement-elements/i, { timeout: 30_000 });
    await this.clickPrimaryContinue();
    await this.page.waitForURL(/\/roof\/[^/]+\/type/i, { timeout: 30_000 });
    return this.runtimeIds.captureRoof();
  }

  captureRoofRuntimeIds(): ProductRuntimeIds {
    return this.runtimeIds.captureRoof();
  }

  async characterizeRoof(data: PropertyCharacterizationData): Promise<ProductRuntimeIds> {
    await this.markPolygons(data);
    await this.markRoofSurfaces(data);
    await this.markMinimumQuotableRoof(data.minimumPanelCount);
    await this.actions.clickFirstVisible([
      this.page.getByTestId('roof-next'),
      this.page.getByRole('button', { name: /calculate|next|continue|חשב|המשך/i }),
    ]);
    await this.expectRoofCalculationDestination(data);
    return this.runtimeIds.capture();
  }

  async expectInsufficientPanelsModal(): Promise<void> {
    await expect(
      this.page
        .getByText(/not enough panels|insufficient panels|פחות מ.?5|אין מספיק פאנלים/i)
        .first(),
    ).toBeVisible();
  }

  private async clickPrimaryContinue(): Promise<void> {
    const continueButton = this.page.getByRole('button', { name: WIZARD.continue }).last();
    await expect(continueButton).toBeEnabled({ timeout: 20_000 });
    await allureStep('Click primary continue', () => continueButton.click());
  }

  private async selectPropertyType(
    propertyType: PropertyCharacterizationData['propertyType'],
  ): Promise<void> {
    const label = PROPERTY_TYPE_LABELS[propertyType];
    const button = this.page.getByRole('button', { name: new RegExp(label, 'i') }).first();
    await button.waitFor({ state: 'visible', timeout: 20_000 });
    await allureStep(`Select property type "${label}"`, () => button.click());
  }

  private async markPolygons(data: PropertyCharacterizationData): Promise<void> {
    for (const polygon of data.polygons) {
      await this.actions.clickIfVisible([
        this.page.getByTestId(`polygon-${polygon}`),
        this.page.getByRole('button', { name: new RegExp(polygon.replace('-', '.*'), 'i') }),
      ]);
    }
  }

  private async markRoofSurfaces(data: PropertyCharacterizationData): Promise<void> {
    if (data.skipsObjectAndRoofSteps) return;
    for (const surface of data.roofSurfaces) {
      await this.actions.clickIfVisible([
        this.page.getByTestId(`roof-surface-${surface}`),
        this.page.getByRole('button', { name: roofSurfaceName(surface) }),
        this.page.getByRole('radio', { name: roofSurfaceName(surface) }),
      ]);
    }
  }

  private async markMinimumQuotableRoof(panelCount: number): Promise<void> {
    await this.actions.fillIfVisible(this.page.getByTestId('panel-count'), String(panelCount));
    await this.actions.fillIfVisible(this.page.getByLabel(/panel|פאנל/i), String(panelCount));
  }

  private async expectRoofCalculationDestination(
    data: PropertyCharacterizationData,
  ): Promise<void> {
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

}

function roofSurfaceName(
  surface: PropertyCharacterizationData['roofSurfaces'][number],
): RegExp {
  const names: Record<PropertyCharacterizationData['roofSurfaces'][number], RegExp> = {
    concrete: /concrete|בטון/i,
    tiles: /tiles|רעפים/i,
    iscoverit: /iscoverit|איסכורית|איזכורית/i,
    parking: /parking|חניה/i,
    'sports-court': /sports|court|מגרש ספורט/i,
  };
  return names[surface];
}
