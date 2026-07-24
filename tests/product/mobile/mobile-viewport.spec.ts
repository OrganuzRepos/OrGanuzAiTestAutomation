/**
 * Mobile-viewport (responsive) UI tests for the product app. Each describe runs the checks
 * under a real phone device profile via test.use({ ...devices[...] }) — no separate
 * Playwright project, so no CI-matrix parity change. Only CHROMIUM device profiles are used
 * (Pixel 5, Galaxy S9+) so the chromium `product` project is not switched to another engine.
 *
 * These drive only layout/visibility — no OTP send, no geocode — so they are CI-safe and
 * skip (never fail) on a genuine dev outage via skipOnOutage.
 */
import { devices } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { skipOnOutage } from '../support/envGate';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../../src/utils/allure';

const MOBILE_DEVICES = ['Pixel 5', 'Galaxy S9+'] as const;

for (const deviceName of MOBILE_DEVICES) {
  // Strip defaultBrowserType — it is worker-scoped and cannot be set in a describe-level
  // test.use; the remaining context options (viewport, isMobile, hasTouch, userAgent) are
  // what make the run mobile, and keep it on the project's chromium browser.
  const { defaultBrowserType: _browser, ...mobileContext } = devices[deviceName];

  test.describe(`Product app on ${deviceName}`, { tag: ['@product', '@mobile'] }, () => {
    test.use(mobileContext);
    test.describe.configure({ timeout: 120_000 });

    test.beforeEach(async ({ product }) => {
      await allureEpic('Product app');
      await allureFeature('Mobile viewport');
      await skipOnOutage(() => product.openCalculator());
    });

    test('The calculator shell renders on a mobile viewport', async ({ product, page }) => {
      await allureStory('Responsive shell');
      await allureSeverity('critical');

      expect(await product.app.isAppShellLoaded(), 'the calculator shell rendered on mobile').toBe(true);
      const viewport = page.viewportSize();
      expect(viewport?.width, 'the run is on a mobile-width viewport').toBeLessThan(600);
    });

    test('The page has no horizontal overflow on mobile', async ({ page }) => {
      await allureStory('No horizontal scroll');
      await allureSeverity('critical');

      const overflow = await page
        .locator('html')
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      // A couple of px of rounding is fine; a real sideways scrollbar is a responsive bug.
      expect(overflow, 'no horizontal scroll (scrollWidth ~= clientWidth)').toBeLessThanOrEqual(2);
    });

    test('The property-type buttons are reachable on a mobile viewport', async ({ page }) => {
      await allureStory('Reachable primary actions');
      await allureSeverity('critical');

      // On mobile the header collapses the login CTA into an icon-only menu, but the wizard's
      // primary property-type choices stay on-screen; assert one is visible and inside the
      // viewport (not clipped off the right edge in RTL).
      const privateHouse = page.getByRole('button', { name: 'בית פרטי' }).first();
      await expect(privateHouse).toBeVisible();
      const box = await privateHouse.boundingBox();
      const viewportWidth = page.viewportSize()!.width;
      expect(box, 'the property-type button is laid out').not.toBeNull();
      expect(box!.x, 'the button starts within the viewport').toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, 'the button ends within the viewport').toBeLessThanOrEqual(viewportWidth + 1);
    });
  });
}

// NOTE: reaching the login dialog on mobile is gated behind an icon-only header menu with
// no accessible name, so it is not driven here (targeting it would be brittle and violate
// the role-based selector convention). The login dialog itself is covered on desktop by
// tests/product/auth/cellular-login.spec.ts.
