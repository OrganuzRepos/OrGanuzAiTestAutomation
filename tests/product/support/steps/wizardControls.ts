/**
 * Single source of truth for the calculator wizard's control selectors (accessible names).
 * Referenced by BOTH the step page objects (steps/*) and ProductAppPage so a live-app
 * relabel is fixed in one place — no selector drift between the two layers. Hebrew by
 * necessity: these strings match the live (RTL) DOM, per the organuz-hebrew-tests split.
 */
export const WIZARD = {
  /** Primary "continue" button, disabled until the current step is satisfied. */
  continue: 'בוא נמשיך',
  /** The step-progress tracker list. */
  stepTrackerList: 'התקדמות השלבים',
  /** The "we found the requested property" confirmation banner text. */
  propertyFoundBanner: 'מצאנו את הנכס המבוקש',
  /** Confirm CTA on the property-confirmation step (proven broad match from ProductAppPage). */
  confirmProperty: /זהו הנכס המבוקש|אפשר להמשיך/,
  /** Heading of the post-confirm auth gate shown to signed-out visitors. */
  authGateHeading: 'הרשמת בעלי נכסים',
} as const;
