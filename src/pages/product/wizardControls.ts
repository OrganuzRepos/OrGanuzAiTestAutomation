/**
 * Single source of truth for the calculator wizard's control selectors (accessible names).
 * Referenced by BOTH the step page objects (src/pages/product/*) and ProductAppPage so a
 * live-app relabel is fixed in one place — no selector drift between the two layers. Hebrew
 * by necessity: these strings match the live (RTL) DOM, per the organuz-hebrew-tests split.
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
