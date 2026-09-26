import { expect, Locator, Page } from '@playwright/test';
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS } from '../../data/productMatrix.constants';
import type { PropertyCharacterizationData } from '../../types/productMatrix.types';
import { allureStep } from '../../utils/allure';
import { WIZARD } from './wizardControls';

type PropertyType = PropertyCharacterizationData['propertyType'];

/**
 * Wizard step 1 — "איתור הנכס": pick a property type and an address. Non-mutating (no
 * project is created until the property is confirmed on the next step). Isolated page
 * object exposed as the `addressStep` fixture. See the organuz-product-e2e skill for the
 * confirmed selectors + the pressSequentially/autocomplete gotcha.
 */
export class AddressStep {
  /** The primary "continue" button ("בוא נמשיך"), disabled until type + address are set. */
  readonly continueButton: Locator;
  /** The address autocomplete combobox. */
  readonly addressBox: Locator;
  /** The first suggestion in the address autocomplete list. */
  readonly firstSuggestion: Locator;
  /** The property-type button for each type key (e.g. PROPERTY_TYPE_PRIVATE_HOUSE → "בית פרטי"). */
  readonly propertyTypeButtons: Record<PropertyType, Locator>;

  constructor(page: Page) {
    this.continueButton = page.getByRole('button', { name: WIZARD.continue }).last();
    this.addressBox = page.getByRole('combobox').first();
    this.firstSuggestion = page.getByRole('option').first();
    this.propertyTypeButtons = Object.fromEntries(
      PROPERTY_TYPES.map((type) => [type, page.getByRole('button', { name: PROPERTY_TYPE_LABELS[type] }).first()]),
    ) as Record<PropertyType, Locator>;
  }

  async selectPropertyType(type: PropertyType): Promise<void> {
    const button = this.propertyTypeButtons[type];
    await button.waitFor({ state: 'visible', timeout: 20_000 });
    await allureStep(`Select property type "${PROPERTY_TYPE_LABELS[type]}"`, () => button.click());
  }

  /** Type an address and pick the first suggestion (pressSequentially fires the autocomplete). */
  async enterAddress(address: string): Promise<void> {
    await allureStep('Focus address field', () => this.addressBox.click());
    await allureStep(`Type address "${address}"`, () => this.addressBox.pressSequentially(address, { delay: 60 }));
    await this.firstSuggestion.waitFor({ state: 'visible', timeout: 20_000 });
    await allureStep('Select first address suggestion', () => this.firstSuggestion.click());
  }

  /** Choose a property type + address (leaves step 1 ready to continue). */
  async choose(type: PropertyType, address: string): Promise<void> {
    await this.selectPropertyType(type);
    await this.enterAddress(address);
  }

  /** Click continue once it is enabled (advances to the property-confirmation step). */
  async continue(): Promise<void> {
    await expect(this.continueButton).toBeEnabled({ timeout: 20_000 });
    await allureStep('Continue from address step', () => this.continueButton.click());
  }
}
