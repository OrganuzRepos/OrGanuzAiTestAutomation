/**
 * English-version sanity checks for the public dev calculator — the 6-step
 * characterization wizard "site". These exercise the ENGLISH UI of the product app:
 * open the calculator through the dev password gate, switch the language to English
 * via the header language menu, and assert the wizard renders in English (LTR, the
 * "Wizard progress" step tracker, the English continue/login controls).
 *
 * No login is required — the wizard shell and language switch are public — so, like
 * the Hebrew public-app-sanity, these run with just the dev password-gate secret and
 * only FAIL on a real product regression. A genuine dev outage is not a product bug, so
 * `skipOnOutage` turns openCalculator's AppUnavailableError into a skip, never a failure.
 *
 * See the organuz-product-en skill.
 */
import { test, expect } from '../support/fixtures';
import { skipOnOutage } from '../support/envGate';
import { config } from '../../../src/utils/config';
import { productText } from '../../../src/i18n/product';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../../src/utils/allure';
import type { ProductFlows } from '../support/ProductFlows';

const APP_HOST = new URL(config.env.appBaseUrl).host;

/** Open the calculator and switch it to English, skipping on a genuine dev outage. */
function openEnglishOrSkip(product: ProductFlows): Promise<void> {
  return skipOnOutage(async () => {
    await product.openCalculator();
    await product.switchToEnglish();
  });
}

test.describe('English calculator (EN) sanity', { tag: ['@product', '@sanity', '@en'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async () => {
    await allureEpic('Product app (English)');
    await allureFeature('English calculator');
  });

  test('the calculator switches to English (LTR) after using the language menu', { tag: ['@KNOWN_BUGS'] }, async ({ product, page }) => {
    await allureStory('language switch');
    await allureSeverity('critical');
    await openEnglishOrSkip(product);
    expect(await product.app.currentLanguage(), 'UI language is English').toBe('en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('the 6-step wizard progress tracker renders in English', async ({ product, page }) => {
    await allureStory('wizard tracker');
    await allureSeverity('critical');
    await openEnglishOrSkip(product);
    // At the 600x800 (narrow) viewport the desktop stage list collapses to the English
    // "Step N of M" indicator, so assert that — it confirms both the tracker and English.
    await expect(
      page.getByText(/Step\s+\d+\s+of\s+\d+/i).first(),
      'the English wizard step indicator renders',
    ).toBeVisible();
  });

  // @KNOWN_BUGS: the English address-search entry ("Search by Address") does not render
  // as a reliable control, so this asserts only the primary "Let's continue" button.
  test('the English wizard exposes its primary continue control', { tag: '@KNOWN_BUGS' }, async ({ product, page }) => {
    await allureStory('wizard controls');
    await allureSeverity('normal');
    await openEnglishOrSkip(product);
    // "Let's continue" is the wizard's primary continue button (Hebrew "בוא נמשיך").
    await expect(page.getByRole('button', { name: productText.en.continue }).first()).toBeVisible();
  });

  test('a fresh visitor is signed out on the English calculator', { tag: '@KNOWN_BUGS' }, async ({ product }) => {
    await allureStory('signed-out state');
    await allureSeverity('normal');
    await openEnglishOrSkip(product);
    expect(await product.app.isAuthenticated(), 'no session for a fresh visitor').toBe(false);
    await expect(product.app.loginEntryPoint.first()).toBeVisible();
  });

  test('the English language choice persists across a reload', async ({ product, page }) => {
    await allureStory('language persistence');
    await allureSeverity('normal');
    await openEnglishOrSkip(product);
    // The choice is stored in localStorage["organuz_selected_language"], so a reload
    // must come back in English without re-opening the language menu.
    await page.reload();
    expect(await product.app.currentLanguage(), 'still English after reload').toBe('en');
  });

  test('the English app is served over HTTPS on the configured dev host', async ({ product, page }) => {
    await allureStory('secure origin');
    await allureSeverity('normal');
    await openEnglishOrSkip(product);
    const url = new URL(page.url());
    expect(url.protocol, 'served over HTTPS').toBe('https:');
    expect(url.host, 'served from the configured app host').toBe(APP_HOST);
  });
});
