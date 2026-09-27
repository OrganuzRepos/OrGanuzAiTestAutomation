import { test as productTest } from './fixtures';
import { journeyStorageState } from './journeySession';

/**
 * Product test bound to the run-scoped customer journey session.
 *
 * `storageState` is resolved as a FIXTURE (per test), not as a static `test.use` value
 * (per file, at collection time) — that is the whole point: the first journey runs with
 * no saved state and logs in for real, saves the session, and every journey after it
 * picks the file up when its own fixture resolves. One OTP send per run instead of five.
 * See journeySession.ts for why this session is separate from the shared role sessions.
 *
 * Because that fixture SHADOWS the `storageState` option, a spec cannot opt out with
 * `test.use({ storageState: undefined })` — it would be ignored. Opting out is therefore
 * its own option: `test.use({ useJourneySession: false })` gives a clean, signed-out
 * context, which is what the sign-out journey needs so it cannot destroy the session the
 * other journeys are resuming.
 */
export const test = productTest.extend<{ useJourneySession: boolean }>({
  useJourneySession: [true, { option: true }],

  storageState: async ({ useJourneySession }, use) => {
    await use(useJourneySession ? journeyStorageState() : undefined);
  },
});

export { expect } from './fixtures';
