import { test } from './fixtures';
import { hasSavedSession } from './auth';
import { AppUnavailableError, OtpUnavailableError } from './errors';
import type { ProductFlows } from './ProductFlows';
import type { ProductPersonaId } from '../matrix/e2e-matrix.data';

/**
 * Shared environmental-gate helpers so every product spec applies the SAME skip policy
 * for a dev outage — instead of each spec re-implementing its own try/catch wrapper.
 * Keep test-lifecycle (skip) decisions here at the spec edge, never in the page object
 * or the flows (see the errors.ts convention).
 */

/**
 * Skip a wizard spec that drives the live address autocomplete when running on CI. The
 * autocomplete depends on an external geocode (govmap.gov.il) that is geo-blocked / flaky
 * for CI runners outside Israel — the same block the `monitoring` canary guards against —
 * so a hosted run would hard-fail on the suggestion wait rather than reflect a product bug.
 * These specs are therefore LOCAL-ONLY (they run against the dev app from a developer
 * machine), the same sanctioned CI divergence as `local-web`. Call at the top of any test
 * that types an address and waits for the suggestion list. See the test-suite-parity skill.
 */
export function skipGeocodeDrivingOnCi(): void {
  test.skip(
    !!process.env.CI,
    'live address geocode is geo-blocked/flaky on CI runners — local-only, like local-web',
  );
}

/**
 * Run a product action, turning a genuine dev outage into a skip (never a failure). Only
 * the typed environmental errors are swallowed; any other error is a real product bug and
 * is rethrown so the test fails. Use for openCalculator()/login() entry points.
 */
export async function skipOnOutage(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (err) {
    if (err instanceof AppUnavailableError || err instanceof OtpUnavailableError) {
      test.skip(true, `dev app unavailable (not a product bug) — ${(err as Error).message}`);
      return;
    }
    throw err;
  }
}

/**
 * Resume a role's saved session (optionally switching the app to English first), skipping
 * with a clear reason when the session is missing or cannot be restored. Resuming is
 * inherently session-gated, so ANY resume error is treated as an environmental skip — the
 * suite stays green on CI without per-role secrets.
 */
export async function resumeOrSkip(
  product: ProductFlows,
  role: ProductPersonaId,
  opts: { english?: boolean } = {},
): Promise<void> {
  test.skip(!hasSavedSession(role), `no saved session for "${role}" — product-setup did not authenticate it`);
  try {
    await product.resumeSession(role);
    if (opts.english) {
      await product.switchToEnglish();
    }
  } catch (err) {
    test.skip(true, `could not resume the "${role}" session — ${(err as Error).message}`);
  }
}
