import { TestType, Fixtures, PlaywrightTestArgs } from '@playwright/test';
import { StepTracker } from './steps/StepTracker';
import { AddressStep } from './steps/AddressStep';
import { PropertyConfirmStep } from './steps/PropertyConfirmStep';

/**
 * Calculator step-page-object fixtures library.
 *
 * Exposes one thin, isolated page object per wizard step (kept in ./steps/*) as a lazy
 * fixture, so EVERY product test can compose the calculator steps without constructing
 * page objects itself. Composed onto the product base test via
 * `withCalculatorStepFixtures(baseTest)` in tests/product/support/fixtures.ts — the same
 * pattern as `withTokenFixtures`. Lazy: a step object is built only when a test requests
 * it, so adding these to the shared base test is side-effect-free.
 */
export interface CalculatorStepFixtures {
  /** Wizard progress tracker ("התקדמות השלבים"). */
  stepTracker: StepTracker;
  /** Step 1 — property type + address ("איתור הנכס"). */
  addressStep: AddressStep;
  /** Step 2 — auto-located property confirmation + the auth boundary. */
  propertyConfirm: PropertyConfirmStep;
}

const stepFixtureImpl: Fixtures<CalculatorStepFixtures, object, PlaywrightTestArgs, object> = {
  stepTracker: async ({ page }, use) => {
    await use(new StepTracker(page));
  },
  addressStep: async ({ page }, use) => {
    await use(new AddressStep(page));
  },
  propertyConfirm: async ({ page }, use) => {
    await use(new PropertyConfirmStep(page));
  },
};

/**
 * Extend a product base test with the calculator step page objects. Returns a new test
 * object with `stepTracker` / `addressStep` / `propertyConfirm` available. The cast
 * bridges the concrete fixture deps (Playwright's built-in `page`) to the caller's
 * generic base-test args.
 */
export function withCalculatorStepFixtures<
  TArgs extends PlaywrightTestArgs,
  TWorker extends object,
>(baseTest: TestType<TArgs, TWorker>): TestType<TArgs & CalculatorStepFixtures, TWorker> {
  return baseTest.extend<CalculatorStepFixtures>(
    stepFixtureImpl as Fixtures<CalculatorStepFixtures, object, TArgs, TWorker>,
  );
}
