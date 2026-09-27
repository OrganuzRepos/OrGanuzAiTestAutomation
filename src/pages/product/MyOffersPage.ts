import { Locator, Page } from '@playwright/test';
import { allureStep } from '../../utils/allure';
import { PERSONAL_AREA } from './accountControls';

/**
 * The signed-in personal area offers list (…/pricing/my-offers) — where a characterized
 * property shows up as a saved offer. Confirmed live on dev: each entry carries the
 * property address, a creation timestamp, and a "לעמוד הפרויקט" CTA that reopens the
 * project back in the calculator wizard at the step it was left on.
 *
 * Thin, isolated page object exposed as the `myOffers` fixture — the personal-area
 * counterpart to the wizard step objects.
 */
export class MyOffersPage {
  /** The landing heading ("אלו הנכסים שלך" / "אלו ההצעות שלך"). */
  readonly heading: Locator;
  /** The "sort offers by:" control rendered above the list. */
  readonly sortControl: Locator;
  /**
   * One per listed offer — its "תאריך יצירת הצעה:" line. Exposed as a LOCATOR, not a
   * count: the list is fetched after the heading paints, so `count()` on its own reads 0
   * before the offers arrive. Assert with a web-first, auto-waiting matcher
   * (`expect(offerCards).not.toHaveCount(0)`).
   */
  readonly offerCards: Locator;
  /** Sidebar entries — DESKTOP ONLY; the personal area renders no sidebar at 600x800. */
  readonly myOffersEntry: Locator;
  readonly checkPropertyEntry: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByText(PERSONAL_AREA.heading).first();
    this.sortControl = page.getByText(PERSONAL_AREA.sortBy).first();
    this.offerCards = page.getByText(PERSONAL_AREA.offerCreatedAt);
    this.myOffersEntry = page.getByRole('button', { name: PERSONAL_AREA.myOffers }).first();
    this.checkPropertyEntry = page.getByRole('button', { name: PERSONAL_AREA.checkProperty }).first();
  }

  /** The listed offer for a given address (assert with toBeVisible). */
  offerFor(address: string): Locator {
    return this.page.getByText(address, { exact: false }).first();
  }

  /**
   * Reopen the first listed project in the calculator wizard. Returns once the app has
   * navigated back out of /pricing into a calculator URL.
   */
  async openFirstProject(): Promise<void> {
    await allureStep('Reopen the saved project from the personal area', () =>
      this.page.getByRole('button', { name: PERSONAL_AREA.openProject }).first().click());
    await this.page.waitForURL(/\/calculator\//i, { timeout: 45_000 });
  }
}
