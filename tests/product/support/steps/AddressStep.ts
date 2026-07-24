import { expect, Locator, Page } from '@playwright/test';
import { PROPERTY_TYPE_LABELS, type PropertyCharacterizationData } from '../../matrix/e2e-matrix.data';
import { allureStep } from '../../../../src/utils/allure';
import { WIZARD } from './wizardControls';

type PropertyType = PropertyCharacterizationData['propertyType'];

/**
 * Wizard step 1 — "איתור הנכס": pick a property type and an address. Non-mutating (no
 * project is created until the property is confirmed on the next step). Isolated page
 * object exposed as the `addressStep` fixture. See the organuz-product-e2e skill for the
 * confirmed selectors + the pressSequentially/autocomplete gotcha.
 */
export class AddressStep {
  constructor(private readonly page: Page) {}

  /** The primary "continue" button ("בוא נמשיך"), disabled until type + address are set. */
  continueButton(): Locator {
    return this.page.getByRole('button', { name: WIZARD.continue }).last();
  }

  /** A property-type button by its data key (e.g. PROPERTY_TYPE_PRIVATE_HOUSE → "בית פרטי"). */
  propertyTypeButton(type: PropertyType): Locator {
    return this.page.getByRole('button', { name: PROPERTY_TYPE_LABELS[type] }).first();
  }

  /** The address autocomplete combobox. */
  addressBox(): Locator {
    return this.page.getByRole('combobox').first();
  }

  async selectPropertyType(type: PropertyType): Promise<void> {
    const button = this.propertyTypeButton(type);
    await button.waitFor({ state: 'visible', timeout: 20_000 });
    await allureStep(`Select property type "${PROPERTY_TYPE_LABELS[type]}"`, () => button.click());
  }

  /** Type an address and pick the first suggestion (pressSequentially fires the autocomplete). */
  async enterAddress(address: string): Promise<void> {
    const box = this.addressBox();
    await allureStep('Focus address field', () => box.click());
    await allureStep(`Type address "${address}"`, () => box.pressSequentially(address, { delay: 60 }));
    await this.page.getByRole('option').first().waitFor({ state: 'visible', timeout: 20_000 });
    await allureStep('Select first address suggestion', () => this.page.getByRole('option').first().click());
  }

  /** Choose a property type + address (leaves step 1 ready to continue). */
  async choose(type: PropertyType, address: string): Promise<void> {
    await this.selectPropertyType(type);
    await this.enterAddress(address);
  }

  /** Click continue once it is enabled (advances to the property-confirmation step). */
  async continue(): Promise<void> {
    await expect(this.continueButton()).toBeEnabled({ timeout: 20_000 });
    await allureStep('Continue from address step', () => this.continueButton().click());
  }
}
