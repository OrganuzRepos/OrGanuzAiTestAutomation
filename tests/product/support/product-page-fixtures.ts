import type {
  Fixtures,
  PlaywrightTestArgs,
  TestType,
} from '@playwright/test';
import { ProductSession } from '../../../src/pages/product';
import { ProductAppPage } from './ProductAppPage';
import type { AuthFixtures } from './auth-fixtures';
import {
  ProductAccountPage,
  ProductAuthPage,
  ProductPageActions,
  ProductRegistrationPage,
  ProductResultsPage,
  ProductRuntimeIdsReader,
  ProductShellPage,
  ProductWizardPage,
} from './pages';

/** Every product page object and shared page helper, initialized through fixtures. */
export interface ProductPageFixtures {
  productPageActions: ProductPageActions;
  productSession: ProductSession;
  productShell: ProductShellPage;
  productRuntimeIds: ProductRuntimeIdsReader;
  productAuth: ProductAuthPage;
  registrationPage: ProductRegistrationPage;
  accountPage: ProductAccountPage;
  wizardPage: ProductWizardPage;
  resultsPage: ProductResultsPage;
  productApp: ProductAppPage;
}

type ProductPageDeps = AuthFixtures & PlaywrightTestArgs;

const productPageFixtureImpl: Fixtures<
  ProductPageFixtures,
  object,
  ProductPageDeps,
  object
> = {
  productPageActions: async ({ page }, use) => {
    await use(new ProductPageActions(page));
  },
  productSession: async ({ page }, use) => {
    await use(new ProductSession(page));
  },
  productShell: async ({ page }, use) => {
    await use(new ProductShellPage(page));
  },
  productRuntimeIds: async ({ page }, use) => {
    await use(new ProductRuntimeIdsReader(page));
  },
  wizardPage: async ({ page, productPageActions, productRuntimeIds }, use) => {
    await use(new ProductWizardPage(page, productPageActions, productRuntimeIds));
  },
  resultsPage: async ({ page, productPageActions, productRuntimeIds }, use) => {
    await use(new ProductResultsPage(page, productPageActions, productRuntimeIds));
  },
  productAuth: async (
    {
      page,
      productShell,
      productPageActions,
      productRuntimeIds,
      loginDialog,
      productSession,
    },
    use,
  ) => {
    await use(
      new ProductAuthPage(
        page,
        productShell,
        productPageActions,
        productRuntimeIds,
        loginDialog,
        productSession,
      ),
    );
  },
  registrationPage: async (
    { page, productShell, productAuth, productPageActions },
    use,
  ) => {
    await use(
      new ProductRegistrationPage(page, productShell, productAuth, productPageActions),
    );
  },
  accountPage: async ({ page, loginDialog }, use) => {
    await use(new ProductAccountPage(page, loginDialog));
  },
  productApp: async (
    {
      productShell,
      productAuth,
      registrationPage,
      accountPage,
      wizardPage,
      resultsPage,
      productRuntimeIds,
    },
    use,
  ) => {
    await use(
      new ProductAppPage({
        shell: productShell,
        auth: productAuth,
        registration: registrationPage,
        account: accountPage,
        wizard: wizardPage,
        results: resultsPage,
        runtimeIds: productRuntimeIds,
      }),
    );
  },
};

/** Add all product page objects to a test type that already exposes LoginDialog. */
export function withProductPageFixtures<
  TArgs extends ProductPageDeps,
  TWorker extends object,
>(baseTest: TestType<TArgs, TWorker>): TestType<TArgs & ProductPageFixtures, TWorker> {
  return baseTest.extend<ProductPageFixtures>(
    productPageFixtureImpl as Fixtures<ProductPageFixtures, object, TArgs, TWorker>,
  );
}
