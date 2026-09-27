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
  /** Step 1's tab switch ("חפש לפי כתובת" / "חיפוש לפי גוש/חלקה"). */
  readonly addressTab: Locator;
  /** The block/parcel identification tab — how a professional identifies a property without
   *  a street address. */
  readonly blockParcelTab: Locator;
  /** The block ("גוש") textbox, only rendered on the block/parcel tab. */
  readonly blockField: Locator;
  /** The parcel ("חלקה") textbox, only rendered on the block/parcel tab. */
  readonly parcelField: Locator;
  /** The block/parcel tab's own submit button ("מצא"), disabled until both fields are set
   *  — see WIZARD.findBlockParcel for the confirmed enablement defect. */
  readonly findBlockParcelButton: Locator;
  /** The validation message the FIXED behaviour should show for a lone block — not yet
   *  rendered by the product; see WIZARD.blockParcelValidationMessage. */
  readonly blockParcelValidation: Locator;

  constructor(page: Page) {
    this.continueButton = page.getByRole('button', { name: WIZARD.continue }).last();
    this.addressBox = page.getByRole('combobox').first();
    this.firstSuggestion = page.getByRole('option').first();
    this.propertyTypeButtons = Object.fromEntries(
      PROPERTY_TYPES.map((type) => [type, page.getByRole('button', { name: PROPERTY_TYPE_LABELS[type] }).first()]),
    ) as Record<PropertyType, Locator>;
    this.addressTab = page.getByRole('tab', { name: WIZARD.addressTab });
    this.blockParcelTab = page.getByRole('tab', { name: WIZARD.blockParcelTab });
    this.blockField = page.getByRole('textbox', { name: WIZARD.block });
    this.parcelField = page.getByRole('textbox', { name: WIZARD.parcel });
    this.findBlockParcelButton = page.getByRole('button', { name: WIZARD.findBlockParcel });
    this.blockParcelValidation = page.getByRole('alert')
      .or(page.getByText(WIZARD.blockParcelValidationMessage));
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

  /** Switch to the block/parcel ("גוש/חלקה") tab — swaps out the address combobox. */
  async switchToBlockParcelTab(): Promise<void> {
    await allureStep('Switch to the block/parcel tab', () => this.blockParcelTab.click());
    await this.blockField.waitFor({ state: 'visible', timeout: 15_000 });
  }

  /** Switch back to the address ("כתובת") tab — swaps out the block/parcel fields. */
  async switchToAddressTab(): Promise<void> {
    await allureStep('Switch to the address tab', () => this.addressTab.click());
    await this.addressBox.waitFor({ state: 'visible', timeout: 15_000 });
  }

  /** Fill the block ("גוש") field. Assumes the block/parcel tab is already active. */
  async fillBlock(value: string): Promise<void> {
    await allureStep(`Fill block "${value}"`, () => this.blockField.fill(value));
  }

  /** Fill the parcel ("חלקה") field. Assumes the block/parcel tab is already active. */
  async fillParcel(value: string): Promise<void> {
    await allureStep(`Fill parcel "${value}"`, () => this.parcelField.fill(value));
  }

  /** Click "מצא" — the block/parcel tab's own submit. Caller decides whether it expects the
   *  button enabled; this does not wait for/assert enablement itself. */
  async submitBlockParcel(): Promise<void> {
    await allureStep('Submit block/parcel', () => this.findBlockParcelButton.click());
  }
}
