/**
 * Single source of truth for the calculator wizard's control selectors (accessible names).
 * Referenced by BOTH the step page objects (src/pages/product/*) and ProductAppPage so a
 * live-app relabel is fixed in one place — no selector drift between the two layers. Hebrew
 * by necessity: these strings match the live (RTL) DOM, per the organuz-hebrew-tests split.
 *
 * The block/parcel entries (`addressTab`/`blockParcelTab`/`block`/`parcel`/`findBlockParcel`/
 * `blockParcelValidationMessage`) were confirmed live against PROD (energy.organuz.com) only
 * — this suite targets dev by default and has no dev credentials to unlock the password
 * gate for manual exploration. See the contractor-wizard-e2e spec's file header.
 */
export const WIZARD = {
  /** Primary "continue" button, disabled until the current step is satisfied. */
  continue: 'בוא נמשיך',
  /** The step-progress tracker list (desktop layout). */
  stepTrackerList: 'התקדמות השלבים',
  /**
   * The mobile step indicator shown instead of the tracker list on narrow viewports (the
   * desktop stage list is not rendered there): Hebrew "שלב 1 מתוך 7" / English "Step 1 of 7".
   */
  mobileStepIndicator: /שלב\s*\d+\s*מתוך\s*\d+|step\s*\d+\s*of\s*\d+/i,
  /**
   * Step 1's own tab switch — how a professional (contractor/company) identifies a
   * property WITHOUT a street address. Confirmed live (prod, energy.organuz.com,
   * 2026-09-27) via the Playwright MCP: a `tablist` with these two tabs; the address tab
   * is the default in a fresh (no persisted localStorage) session.
   */
  addressTab: 'חפש לפי כתובת',
  /** The block/parcel tab — see `addressTab`. */
  blockParcelTab: 'חיפוש לפי גוש/חלקה',
  /** The block ("גוש") textbox on the block/parcel tab. */
  block: 'גוש',
  /** The parcel ("חלקה") textbox on the block/parcel tab. */
  parcel: 'חלקה',
  /**
   * The block/parcel tab's own submit button ("find"). Starts disabled.
   *
   * KNOWN GAP (live on prod 2026-09-27 and dev 2026-09-28): it enables with ONLY "גוש"
   * (block) filled and "חלקה" (parcel) EMPTY — a block without a parcel does not identify
   * a property. The contractor-wizard-e2e gating check pins this and carries a
   * `known-gap` annotation naming the correct behaviour.
   */
  findBlockParcel: 'מצא',
  /**
   * Validation message expected once submitting a lone block (no parcel) is rejected. NOT
   * YET IMPLEMENTED as of this writing.
   *
   * KNOWN GAP (live on prod 2026-09-27 and dev 2026-09-28): the app shows no error, no
   * toast and no validation text at all — it silently clears "גוש" and returns "מצא" to
   * disabled. Note this only happens once the map is interactive; submitting earlier is
   * dropped entirely (see AddressStep.waitForMapReady).
   * The pattern below is what the FIXED behaviour should surface (an ARIA alert/status
   * role, or else generic Hebrew "field required" phrasing) — it is not pinned to any
   * copy the product has actually written, because none exists yet.
   */
  blockParcelValidationMessage: /חובה למלא חלקה|יש להזין חלקה|שדה חובה|נא למלא/,
  /**
   * The embedded map iframe (Israel Mapping Center / govmap). Matched by src because it
   * carries no accessible name. Used as a readiness signal — see AddressStep.mapControl.
   */
  mapFrame: 'iframe[src*="govmap"], iframe[src*="/iframe/"]',
  /** The "we found the requested property" confirmation banner text. */
  propertyFoundBanner: 'מצאנו את הנכס המבוקש',
  /**
   * Confirm CTA on the property-confirmation step. Desktop labels it "זהו הנכס המבוקש,
   * אפשר להמשיך"; the mobile layout advances the same step with the primary "בוא נמשיך"
   * button — match either so the step works at any viewport.
   */
  confirmProperty: /זהו הנכס המבוקש|אפשר להמשיך|בוא נמשיך/,
  /** Heading of the post-confirm auth gate shown to signed-out visitors. */
  authGateHeading: 'הרשמת בעלי נכסים',
  /**
   * The seven characterization stages, in order, as the tracker renders them (confirmed
   * live on dev). Stage 1 is the only one labelled before the wizard starts; the rest get
   * their label once reached, so a spec asserts on the PREFIX it has walked to.
   */
  stages: [
    'איתור הנכס',
    'סימון השטח',
    'שאלות נוספות',
    'מחשבים',
    'תוצאות',
    'הצעות',
    'בחירת הצעה',
  ],
  /**
   * A COMPLETED stage in the tracker turns into a back-navigation button labelled
   * "חזרה לשלב <stage>" — the wizard's only in-app way back to an earlier step.
   */
  backToStage: (stage: string): RegExp => new RegExp(`חזרה לשלב\\s*${stage}`),
  /** Heading of the roof-type step (…/roof/<id>/type). */
  roofTypeHeading: 'מיקום המערכת ובחירת סוג הגג',
  /**
   * The roof-type step replaces the generic "בוא נמשיך" with its own CTA. Marking the
   * roof type happens inside the map iframe, so this step is the automation terminus.
   */
  roofTypeContinue: 'סימנתי את השטח הרלוונטי, אפשר להמשיך',
  /**
   * Guard dialog raised when the roof-type CTA is clicked with nothing marked — the
   * wizard refuses to advance. Asserted by the negative journey check.
   */
  roofTypeGuard: /יש לבחור את סוג הגג ואת המיקום/,
} as const;
