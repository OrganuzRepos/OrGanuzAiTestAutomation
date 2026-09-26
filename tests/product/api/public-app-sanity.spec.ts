/**
 * Sanity checks for the public dev calculator — no login, so they run (and don't skip)
 * with just the dev password-gate secret, exactly like token-sanity. They pass against
 * a healthy dev app and only fail on a real product regression (missing login entry
 * point, wrong host, no server call). A genuine infrastructure outage is not a product
 * bug, so `skipOnOutage` turns openCalculator's AppUnavailableError into a skip, never a
 * failure.
 */
import { test, expect } from '../support/fixtures';
import { skipOnOutage } from '../support/envGate';
import { TokenInterceptor } from '../support/TokenInterceptor';
import { config } from '../../../src/utils/config';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../../src/utils/allure';

const APP_HOST = new URL(config.env.appBaseUrl).host;

test.describe('Public dev calculator sanity', { tag: ['@product', '@sanity'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async () => {
    await allureEpic('Product app');
    await allureFeature('Public calculator');
  });

  test('The dev calculator shell loads after opening the password gate', async ({ product }) => {
    await allureStory('App shell');
    await allureSeverity('critical');
    await skipOnOutage(() => product.openCalculator());
    expect(await product.app.isAppShellLoaded(), 'The calculator shell came up').toBe(true);
  });

  test('A fresh visitor is signed out on the public calculator', async ({ product }) => {
    await allureStory('Signed-out state');
    await allureSeverity('normal');
    await skipOnOutage(() => product.openCalculator());
    expect(await product.app.isAuthenticated(), 'No session for a fresh visitor').toBe(false);
    await product.expectLoggedOut();
  });

  test('The login entry point is available to a signed-out visitor', async ({ product }) => {
    await allureStory('Login entry point');
    await allureSeverity('critical');
    await skipOnOutage(() => product.openCalculator());
    // The public entry point is the header CTA on desktop, or the account icon on the mobile
    // layout — loginEntryPoint() matches either. The phone field appears only after it opens.
    await expect(product.app.loginEntryPoint.first()).toBeVisible();
  });

  test('The app is served over HTTPS from the configured dev host', async ({ product, page }) => {
    await allureStory('Secure origin');
    await allureSeverity('normal');
    await skipOnOutage(() => product.openCalculator());
    const url = new URL(page.url());
    expect(url.protocol, 'Served over HTTPS').toBe('https:');
    expect(url.host, 'Served from the configured app host').toBe(APP_HOST);
  });

  test('The calculator makes a public server call carrying the token on load', async ({ product, page }) => {
    await allureStory('Public server call');
    await allureSeverity('critical');
    const tokens = new TokenInterceptor(page).start();
    try {
      await skipOnOutage(() => product.openCalculator());
      await tokens.waitForToken({ timeoutMs: 20_000 }).catch(() => undefined);
      expect(tokens.all().length, 'At least one server call carrying a token was made on load').toBeGreaterThan(0);
    } finally {
      tokens.stop();
    }
  });
});
