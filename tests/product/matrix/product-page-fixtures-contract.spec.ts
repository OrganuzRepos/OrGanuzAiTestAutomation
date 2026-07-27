import { expect, test } from '../support/fixtures';

test.describe('Product page-object fixture contract', { tag: ['@product'] }, () => {
  test('initializes every page object once and injects the same instances into the facade', async ({
    loginDialog,
    productPageActions,
    productSession,
    productShell,
    productRuntimeIds,
    productAuth,
    registrationPage,
    accountPage,
    wizardPage,
    resultsPage,
    productApp,
    product,
    registration,
  }) => {
    expect(productPageActions).toBeTruthy();
    expect(productSession).toBeTruthy();
    expect(productAuth.loginDialog).toBe(loginDialog);

    expect(productApp.shell).toBe(productShell);
    expect(productApp.runtimeIds).toBe(productRuntimeIds);
    expect(productApp.auth).toBe(productAuth);
    expect(productApp.registration).toBe(registrationPage);
    expect(productApp.account).toBe(accountPage);
    expect(productApp.wizard).toBe(wizardPage);
    expect(productApp.results).toBe(resultsPage);

    expect(product.app).toBe(productApp);
    expect(registration.app).toBe(productApp);
  });
});
