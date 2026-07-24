import { Locator, Page } from '@playwright/test';
import { WIZARD } from './wizardControls';

/**
 * The wizard progress tracker ("התקדמות השלבים") — the ordered list of characterization
 * stages shown on every calculator step. Thin, isolated page object so any spec can
 * assert on the wizard's stage list / current stage via the `stepTracker` fixture.
 */
export class StepTracker {
  constructor(private readonly page: Page) {}

  /** The progress list element. */
  list(): Locator {
    return this.page.getByRole('list', { name: WIZARD.stepTrackerList });
  }

  /** True once the tracker has rendered (the calculator shell is up). */
  async isVisible(): Promise<boolean> {
    return this.list().isVisible({ timeout: 15_000 }).catch(() => false);
  }

  /** The visible stage labels, in order. */
  async stages(): Promise<string[]> {
    const items = await this.list().getByRole('listitem').allInnerTexts().catch(() => []);
    return items.map((s) => s.trim()).filter(Boolean);
  }
}
