/**
 * Single source of truth for the signed-in personal area ("איזור אישי" → /pricing/*),
 * confirmed live on dev. Referenced by the MyOffersPage page object so a relabel is fixed
 * in one place. Hebrew by necessity: the personal area is Hebrew regardless of the
 * calculator's language toggle (see productChrome in src/i18n/product.ts).
 */
export const PERSONAL_AREA = {
  /**
   * Desktop-only: the header user button, named "<name>, <role>". At the product
   * project's narrow 600x800 viewport the header collapses this into a nameless account
   * icon, so the account page falls back to that icon — the same two-layout split
   * LoginDialog.open() already makes for the login CTA.
   */
  userMenuButton: /בעל נכס|יועץ|קבלן|חברת|יזם/,
  /** URL the personal area lands on. */
  path: /\/pricing\/my-offers/i,
  /**
   * Landing heading. The wording follows what the role sees listed — properties for a
   * property owner, offers for a contractor — so match either.
   */
  heading: /אלו (הנכסים|ההצעות) שלך/,
  /** Sidebar entry every signed-in role has. */
  myOffers: 'ההצעות שלי',
  /** Sidebar entry that starts a new property check (returns to the calculator). */
  checkProperty: /^בדיקת נכס/,
  /** The "sort offers by:" control above the list. */
  sortBy: /סידור הצעות לפי:/,
  /** Per-offer creation-date line ("תאריך יצירת הצעה: dd/mm/yyyy hh:mm:ss"). */
  offerCreatedAt: /תאריך יצירת הצעה:/,
  /**
   * Per-offer CTA that reopens the saved project back in the calculator wizard, at the
   * step it was left on — the customer's "resume my characterization" path.
   */
  openProject: 'לעמוד הפרויקט',
} as const;
