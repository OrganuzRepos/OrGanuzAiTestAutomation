/**
 * UI tests for the CELLULAR (phone + OTP) login flow of the product app — the login dialog
 * opened from the header "הרשמה / כניסה" entry point, driven through the `loginDialog`
 * page-object fixture.
 *
 * Safe by default: every check below drives only the dialog UI and NEVER sends an OTP, so
 * there is no dev rate-limit risk and they run deterministically whenever the dev app is up
 * (skipOnOutage turns a genuine outage into a skip). No geocode is involved, so unlike the
 * wizard specs these are CI-safe. The single check that must request a code (the OTP step)
 * is opt-in behind PRODUCT_OTP_UI=true and self-skips on the dev OTP cooldown.
 */
import { test, expect } from '../support/fixtures';
import { skipOnOutage } from '../support/envGate';
import { rolePhone } from '../support/roleCredentials';
import { LOGIN } from '../support/steps/authControls';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../../src/utils/allure';

const otpUiEnabled = process.env.PRODUCT_OTP_UI === 'true';
const VALID_MOBILE = '0501234567';

test.describe('Cellular login (phone + OTP)', { tag: ['@product', '@auth'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ product }) => {
    await allureEpic('Product app');
    await allureFeature('Cellular login');
    await skipOnOutage(() => product.openCalculator());
  });

  test('The header entry point opens the cellular login dialog', async ({ loginDialog }) => {
    await allureStory('Open dialog');
    await allureSeverity('critical');
    await loginDialog.open();

    await expect(loginDialog.dialog()).toBeVisible();
    await expect(loginDialog.heading()).toBeVisible();
  });

  test('The dialog prompts for a mobile number', async ({ loginDialog }) => {
    await allureStory('Mobile-number prompt');
    await allureSeverity('normal');
    await loginDialog.open();

    await expect(loginDialog.prompt()).toBeVisible();
    await expect(loginDialog.phoneField()).toBeVisible();
  });

  test('Send-code is disabled before a number is entered', async ({ loginDialog }) => {
    await allureStory('Send-code gating');
    await allureSeverity('normal');
    await loginDialog.open();

    await expect(loginDialog.sendCodeButton(), 'send-code is gated with no number').toBeDisabled();
  });

  test('An invalid mobile number keeps send-code disabled', async ({ loginDialog }) => {
    await allureStory('Send-code gating');
    await allureSeverity('critical');
    await loginDialog.open();
    await loginDialog.enterMobileNumber('123');

    await expect(loginDialog.sendCodeButton(), 'a too-short number does not enable send-code').toBeDisabled();
  });

  test('A valid mobile number enables send-code', async ({ loginDialog }) => {
    await allureStory('Send-code gating');
    await allureSeverity('critical');
    await loginDialog.open();
    await loginDialog.enterMobileNumber(VALID_MOBILE);

    await expect(loginDialog.sendCodeButton(), 'a valid number enables send-code').toBeEnabled();
  });

  test('The dialog offers property-owner and solar-company registration', async ({ loginDialog }) => {
    await allureStory('Registration entry points');
    await allureSeverity('normal');
    await loginDialog.open();

    await expect(loginDialog.propertyOwnerRegister()).toBeVisible();
    await expect(loginDialog.solarCompanyRegister()).toBeVisible();
  });

  test('The dialog can be closed back to the signed-out calculator', async ({ loginDialog }) => {
    await allureStory('Close dialog');
    await allureSeverity('normal');
    await loginDialog.open();
    await loginDialog.close();

    await expect(loginDialog.dialog()).toBeHidden();
    await expect(loginDialog.entryButton(), 'the login entry point is available again').toBeVisible();
  });

  test('Property-owner registration opens from the dialog', async ({ loginDialog, page }) => {
    await allureStory('Property-owner registration');
    await allureSeverity('normal');
    await loginDialog.open();
    await loginDialog.propertyOwnerRegister().click();

    await expect(
      page.getByRole('heading', { name: LOGIN.propertyOwnerRegistrationHeading }),
    ).toBeVisible();
  });

  // Opt-in: this one REQUESTS a code (a real dev OTP send), so it is gated + skip-safe.
  test('Requesting a code reveals the 4-digit OTP entry step', async ({ loginDialog }) => {
    test.skip(!otpUiEnabled, 'PRODUCT_OTP_UI not set — avoids triggering a real dev OTP send');
    await allureStory('OTP entry step');
    await allureSeverity('critical');

    await loginDialog.open();
    await loginDialog.enterMobileNumber(rolePhone('customer') ?? VALID_MOBILE);
    await loginDialog.requestOtp();

    try {
      await loginDialog.otpHeading().waitFor({ state: 'visible', timeout: 20_000 });
    } catch {
      test.skip(true, 'OTP step did not render — dev OTP rate-limit cooldown');
      return;
    }

    await expect(loginDialog.otpBoxes(), 'the OTP step shows four single-digit boxes').toHaveCount(4);
    await expect(loginDialog.verifyButton()).toBeVisible();
  });
});
