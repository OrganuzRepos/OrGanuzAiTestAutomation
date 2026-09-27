import * as fs from 'fs';
import * as path from 'path';
import type { Page } from '@playwright/test';

/**
 * A run-scoped authenticated session for the customer end-to-end journeys.
 *
 * The dev app rate-limits OTP sends per phone, so a five-journey file that logged in five
 * times would trip the cooldown and self-skip most of its own checks. Instead the FIRST
 * journey performs the one real login and saves its storageState here; the journeys that
 * follow (running in serial) start from that saved session, so the file costs exactly one
 * OTP send per run. Same idea as the per-role `product-setup` sessions (see auth.ts), but
 * owned by this spec file rather than a setup project — which is what lets the final
 * journey sign out without invalidating a session other specs reuse.
 *
 * Deliberately a SEPARATE file from playwright/.auth/product-customer.json: the logout
 * journey destroys this session, and it must never destroy the shared role session.
 */
const JOURNEY_SESSION_FILE = path.resolve(
  __dirname,
  '../../../playwright/.auth/product-customer-journey.json',
);

/** True when this run has already authenticated the journey customer. */
export function hasJourneySession(): boolean {
  return fs.existsSync(JOURNEY_SESSION_FILE);
}

/**
 * The storageState to start a journey from: the saved session once it exists, otherwise
 * `undefined` (a clean, signed-out context) so the first journey can log in for real.
 */
export function journeyStorageState(): string | undefined {
  return hasJourneySession() ? JOURNEY_SESSION_FILE : undefined;
}

/** Persist the signed-in context so the journeys that follow resume it. */
export async function saveJourneySession(page: Page): Promise<void> {
  fs.mkdirSync(path.dirname(JOURNEY_SESSION_FILE), { recursive: true });
  await page.context().storageState({ path: JOURNEY_SESSION_FILE });
}

/** Drop the saved session (after signing out, so a later run logs in cleanly). */
export function clearJourneySession(): void {
  fs.rmSync(JOURNEY_SESSION_FILE, { force: true });
}
