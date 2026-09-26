/**
 * End-to-end CELLULAR login using the OTP that arrives by real SMS, read back from Twilio.
 *
 * Unlike the dev app (fixed OTP 7777), production delivers a live code by SMS. This spec
 * drives the real login: it opens the dialog, enters the customer's cellular number (from
 * the env file — CUSTOMER_PHONE), requests a code (a REAL SMS send), reads the code off the
 * Twilio inbound-messages API, enters it, and asserts the customer is signed in. It targets
 * whichever env QA_TARGET_ENV selects (dev or prod), so the same test verifies SMS login on
 * both once Twilio + a real number are wired.
 *
 * It is opt-in and skip-safe by construction — it never fails on a missing dependency:
 *  - PRODUCT_SMS_LOGIN=true is required (it triggers a real SMS send + creates a session);
 *  - Twilio creds absent (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) → skip (cannot read SMS);
 *  - no customer phone for the env → skip;
 *  - the code not arriving in time (carrier/Twilio lag or an OTP cooldown) → skip;
 *  - a genuine dev/prod outage → skip via skipOnOutage.
 * A real product regression (the code arrives but sign-in does not take) still fails.
 */
import { test, expect } from '../support/fixtures';
import { skipOnOutage } from '../support/envGate';
import { rolePhone } from '../support/roleCredentials';
import { fetchOtpFromSms, twilioConfigured, toE164 } from '../../../src/utils/twilioOtp';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../../src/utils/allure';

const smsLoginEnabled = process.env.PRODUCT_SMS_LOGIN === 'true';
// The four single-digit boxes in the dialog — the SMS code length must match.
const OTP_DIGITS = 4;

test.describe('Cellular login via SMS OTP (Twilio)', { tag: ['@product', '@auth'] }, () => {
  // A real SMS round-trip is slow (carrier + Twilio delivery); widen the budget.
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async () => {
    await allureEpic('Product app');
    await allureFeature('Cellular login');
  });

  test('A customer signs in with the OTP delivered by SMS', async ({ product, loginDialog }) => {
    test.skip(!smsLoginEnabled, 'PRODUCT_SMS_LOGIN not set — avoids a real SMS send + login');
    test.skip(!twilioConfigured(), 'Twilio creds absent (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) — cannot read the SMS');
    await allureStory('SMS OTP login');
    await allureSeverity('critical');

    const phone = rolePhone('customer');
    test.skip(!phone, 'No customer phone for this env — set CUSTOMER_PHONE');

    // Open the calculator (unlocks the dev gate; no-op on prod), turning an outage into a skip.
    await skipOnOutage(() => product.openCalculator());

    await test.step('Request a code for the customer number', async () => {
      await loginDialog.open();
      await loginDialog.enterMobileNumber(phone!);
      await expect(loginDialog.sendCodeButton, 'send-code enabled for a valid number').toBeEnabled();
    });

    // The Twilio number that receives the SMS defaults to the login phone; override with
    // TWILIO_OTP_NUMBER when the receiving number differs from the number typed at login.
    const otpNumber = process.env.TWILIO_OTP_NUMBER?.trim() || phone!;
    const sinceMs = Date.now();
    await loginDialog.requestOtp();

    const code = await test.step('Read the OTP from the SMS via Twilio', () =>
      fetchOtpFromSms({ toNumber: otpNumber, sinceMs, digits: OTP_DIGITS }));
    test.skip(!code, `No OTP SMS reached ${toE164(otpNumber)} in time — carrier/Twilio lag or an OTP cooldown`);

    await test.step('Enter the code and sign in', async () => {
      await loginDialog.waitForOtpStep();
      await loginDialog.enterOtp(code!);
      await loginDialog.submitOtp();
    });

    await expect
      .poll(() => product.app.isAuthenticated(), {
        timeout: 15_000,
        message: 'the SMS OTP signed the customer in',
      })
      .toBe(true);
  });
});
