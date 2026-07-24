import { TestType, Fixtures, PlaywrightTestArgs } from '@playwright/test';
import { ProductFlows } from './ProductFlows';
import { CalculatorFlow } from './flows/CalculatorFlow';
import type { CalculatorStepFixtures } from './step-fixtures';

/**
 * Calculator flow-layer fixtures.
 *
 * Wires the mid-layer CalculatorFlow (see flows/CalculatorFlow.ts) as a lazy fixture that
 * composes the step page objects (from withCalculatorStepFixtures) with the high-level
 * ProductFlows (`product`). Composed via `withCalculatorFlowFixtures(baseTest)` in
 * fixtures.ts, AFTER the step fixtures it depends on — so specs get a ready `calculatorFlow`
 * without assembling the page objects themselves. This is the page → flow → test layering.
 */
export interface CalculatorFlowFixtures {
  /** Mid-layer wizard flow, composed from the step page objects + ProductFlows. */
  calculatorFlow: CalculatorFlow;
}

/** Deps the flow fixture needs from the base test: ProductFlows + the step page objects. */
export interface CalculatorFlowDeps extends CalculatorStepFixtures {
  product: ProductFlows;
}

const flowFixtureImpl: Fixtures<
  CalculatorFlowFixtures,
  object,
  CalculatorFlowDeps & PlaywrightTestArgs,
  object
> = {
  calculatorFlow: async ({ product, stepTracker, addressStep, propertyConfirm }, use) => {
    await use(new CalculatorFlow(product, stepTracker, addressStep, propertyConfirm));
  },
};

/**
 * Extend a product base test (already carrying `product` + the calculator step fixtures)
 * with the `calculatorFlow` mid-layer flow. The cast bridges the concrete fixture deps to
 * the caller's generic base-test args.
 */
export function withCalculatorFlowFixtures<
  TArgs extends CalculatorFlowDeps & PlaywrightTestArgs,
  TWorker extends object,
>(baseTest: TestType<TArgs, TWorker>): TestType<TArgs & CalculatorFlowFixtures, TWorker> {
  return baseTest.extend<CalculatorFlowFixtures>(
    flowFixtureImpl as Fixtures<CalculatorFlowFixtures, object, TArgs, TWorker>,
  );
}
