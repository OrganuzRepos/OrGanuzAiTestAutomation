/**
 * Anti-fraud / abuse-control checks for the Organuz product app.
 *
 * Sibling of account-takeover.spec.ts: asserts the product resists input tampering,
 * injection, brute-force and information leakage that enable fraud. Same env model
 * (QA_TARGET_ENV), same non-destructive guarantees (fabricated identities, verify-only —
 * never an OTP send), same reachability-canary skip for backend checks. Requests go
 * through the FraudApi endpoint client, which returns a parsed response.
 *
 * Browserless (`APIRequestContext`). Tagged @fraud @anti-abuse @security.
 */
import { test, expect } from '@playwright/test';
import { allureEpic, allureFeature, allureStory, allureSeverity } from '../../src/utils/allure';
import { HttpStatus } from '../../src/utils/httpStatus';
import { FraudApi } from './support/api';
import {
  FAKE,
  OTP_VERIFY_CALL,
  INTERNAL_LEAK_MARKERS,
  OTP_CONTRACT_SKIP_REASON,
  MAX_OTP_ATTEMPTS,
  isUnknownRoute,
  grantsSession,
} from './support/target';

test.describe('Anti-fraud controls (Organuz product app)', { tag: ['@fraud', '@anti-abuse', '@security'] }, () => {
  test.beforeEach(async () => {
    await allureEpic('Fraud & account takeover');
    await allureFeature('Anti-fraud controls');
  });

  // ---- App-origin (env-portable) --------------------------------------------
  test('FRAUD-01 a script payload in the query string is not reflected unescaped (no reflected XSS)', async ({ request }) => {
    await allureStory('reflected XSS');
    await allureSeverity('critical');
    const marker = '__qa_fraud_xss__';
    const payload = `<script>${marker}</script>`;
    const res = await new FraudApi(request).appWithQuery(payload);
    expect(res.text, 'the raw <script> payload must not be reflected into the document').not.toContain(payload);
  });

  test('FRAUD-02 any session/auth cookie is set with Secure + HttpOnly (theft resistance)', async ({ request }, testInfo) => {
    await allureStory('cookie hygiene');
    await allureSeverity('normal');
    const res = await new FraudApi(request).appDocument();
    const setCookies = res.headersArray.filter((h) => h.name.toLowerCase() === 'set-cookie');
    // The SPA may set no cookies on the initial document — nothing to protect, nothing to fail.
    expect(res.status, 'cookie policy must be checked on a successful document response').toBe(HttpStatus.OK);
    testInfo.annotations.push({ type: 'cookie-count', description: String(setCookies.length) });
    for (const { value } of setCookies) {
      const name = value.split('=')[0].trim();
      expect(value.toLowerCase(), `cookie "${name}" must be Secure`).toMatch(/;\s*secure(?:;|$)/i);
      expect(value.toLowerCase(), `cookie "${name}" must be HttpOnly`).toMatch(/;\s*httponly(?:;|$)/i);
    }
  });

  // ---- Auth backend (guarded by the reachability canary) ---------------------
  test('FRAUD-03 an injection payload is treated as data — JSON error, never a 5xx or HTML', async ({ request }) => {
    await allureStory('injection is data, not code');
    await allureSeverity('critical');
    const api = new FraudApi(request);
    const block = await api.authBlockReason();
    test.skip(!!block, block);

    const injection = "'; DROP TABLE users;-- <script>alert(1)</script>";
    const res = await api.authRpc(injection, { phone: injection });
    expect(res.status, 'injection input must not crash the backend (no 5xx)').toBeLessThan(HttpStatus.SERVER_ERROR_MIN);
    expect(res.text, 'injection input must not be reflected unescaped').not.toContain('<script>alert(1)</script>');
  });

  test('FRAUD-04 error responses do not leak stack traces or server internals', async ({ request }) => {
    await allureStory('no internal leakage in errors');
    await allureSeverity('normal');
    const api = new FraudApi(request);
    const block = await api.authBlockReason();
    test.skip(!!block, block);

    const res = await api.authRaw('action=token&this=is&not=a&valid=body');
    const body = res.text.toLowerCase();
    for (const marker of INTERNAL_LEAK_MARKERS) {
      expect(body, `an error must not leak "${marker}"`).not.toContain(marker.toLowerCase());
    }
  });

  test('FRAUD-05 repeated wrong OTPs for a fabricated phone never authenticate (brute-force resistance)', async ({ request }) => {
    await allureStory('OTP brute-force');
    await allureSeverity('blocker');
    test.skip(!OTP_VERIFY_CALL, OTP_CONTRACT_SKIP_REASON);
    const api = new FraudApi(request);
    const block = await api.authBlockReason();
    test.skip(!!block, block);

    // Bounded, verify-only (no OTP send) attempts against a phone registered to nobody.
    // None may yield a session, and responses must stay uniform (no "user exists" leak).
    const bodies: string[] = [];
    for (const code of FAKE.wrongOtps.slice(0, MAX_OTP_ATTEMPTS)) {
      const res = await api.authOtpVerify(FAKE.phone, code);
      test.skip(isUnknownRoute(res.status, res.text), OTP_CONTRACT_SKIP_REASON);
      bodies.push(res.text);
      expect(grantsSession(res.text), `wrong OTP "${code}" must never authenticate`).toBeFalsy();
    }
    // Uniform rejection: a fabricated (never-registered) phone must not reveal itself via
    // a materially different response than any other wrong-code attempt.
    const distinctShapes = new Set(bodies.map((b) => b.replace(/\d+/g, '#').slice(0, 200)));
    expect(distinctShapes.size, 'wrong-OTP responses must be uniform (no account enumeration)').toBeLessThanOrEqual(1);
  });

  test('FRAUD-06 the auth backend does not reflect an arbitrary Origin with credentials', async ({ request }) => {
    await allureStory('backend CORS credential leak');
    await allureSeverity('critical');
    const api = new FraudApi(request);
    const block = await api.authBlockReason();
    test.skip(!!block, block);

    const evil = 'https://evil.attacker.example';
    const res = await api.authPreflight(evil);
    const allowOrigin = res.headers['access-control-allow-origin'] ?? '';
    const allowCreds = (res.headers['access-control-allow-credentials'] ?? '').toLowerCase();
    const leaks = (allowOrigin === evil || allowOrigin === '*') && allowCreds === 'true';
    expect(leaks, 'backend must not allow an attacker Origin together with credentials').toBeFalsy();
  });
});
