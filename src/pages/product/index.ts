/**
 * Product-app page objects for the dev calculator wizard. Moved here from
 * tests/product/support so they live alongside the marketing page objects in `src/pages`
 * — the shared library layer — instead of inside `tests/`. They depend only on `src/`
 * (types in src/types, labels in src/data, i18n in src/i18n), keeping the dependency arrow
 * pointing from tests → src. Consumed by the product fixtures/flows under tests/product.
 */
export { AddressStep } from './AddressStep';
export { StepTracker } from './StepTracker';
export { PropertyConfirmStep } from './PropertyConfirmStep';
export { LoginDialog } from './LoginDialog';
export { WIZARD } from './wizardControls';
export { LOGIN } from './authControls';
