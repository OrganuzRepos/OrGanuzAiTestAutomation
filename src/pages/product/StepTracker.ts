import { Locator, Page } from '@playwright/test';
import { WIZARD } from './wizardControls';

/**
 * The wizard progress tracker ("התקדמות השלבים") — the ordered list of characterization
 * stages shown on every calculator step. Thin, isolated page object so any spec can
 * assert on the wizard's stage list / current stage via the `stepTracker` fixture.
 */
export class StepTracker {
  /** The progress list element (desktop layout). */
  readonly list: Locator;
  /** The mobile step indicator ("שלב 1 מתוך 7") shown instead of the list on narrow viewports. */
  readonly mobileIndicator: Locator;

  constructor(page: Page) {
    this.list = page.getByRole('list', { name: WIZARD.stepTrackerList });
    this.mobileIndicator = page.getByText(WIZARD.mobileStepIndicator).first();
  }

  /** True once the wizard progress has rendered — the desktop list OR the mobile indicator. */
  async isVisible(): Promise<boolean> {
    if (await this.list.isVisible({ timeout: 15_000 }).catch(() => false)) return true;
    return this.mobileIndicator.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  /**
   * The visible stage labels, in order. Desktop renders the full stage list; the mobile
   * layout has no per-stage list, so it falls back to the single "שלב X מתוך Y" indicator.
   */
  async stages(): Promise<string[]> {
    const items = await this.list.getByRole('listitem').allInnerTexts().catch(() => []);
    const labels = items.map((s) => s.trim()).filter(Boolean);
    if (labels.length) return labels;
    const mobile = await this.mobileIndicator.allInnerTexts().catch(() => []);
    return mobile.map((s) => s.trim()).filter(Boolean);
  }
}
