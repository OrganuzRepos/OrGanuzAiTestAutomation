import { test as productTest } from './fixtures';
import { journeyStorageState, restoreJourneyTabSession } from './journeySession';

/** Resolve the serial suite's session when each test starts, after the first login. */
export const test = productTest.extend<{ restoreTabSession: void }>({
  restoreTabSession: [async ({ context }, use) => {
    await restoreJourneyTabSession(context);
    await use();
  }, { auto: true }],
  storageState: async ({}, use) => {
    await use(journeyStorageState());
  },
});

export { expect } from './fixtures';
