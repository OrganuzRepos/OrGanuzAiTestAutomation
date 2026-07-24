import { anyLoginEntry } from '../../../../src/i18n/product';

/**
 * Single source of truth for the cellular (phone + OTP) login dialog selectors, confirmed
 * against the live dev app. Referenced by the LoginDialog page object. Hebrew by necessity
 * (matches the live RTL DOM), except `entry` which matches the header CTA in he + en.
 */
export const LOGIN = {
  /** Header CTA that opens the dialog ("הרשמה / כניסה" / EN "Login / Register"). */
  entry: anyLoginEntry,
  /** Dialog heading. */
  dialogHeading: 'התחברות',
  /** Mobile-number prompt paragraph. */
  prompt: 'יש להזין מספר טלפון נייד לקבלת קוד אימות:',
  /** The cellular-number field. */
  phoneField: 'מספר הטלפון הנייד שלך',
  /** The "send me a verification code" button (disabled until a valid number is entered). */
  sendCode: 'שלחו לי קוד אימות לנייד',
  /** The dialog close (✕) control. */
  close: 'Close',
  /** The two "register here" CTAs (property owners [0], solar company [1]). */
  register: 'הירשמו כאן',
  /** Heading of the property-owner registration form opened from the dialog. */
  propertyOwnerRegistrationHeading: 'הרשמת בעלי נכסים',
  /** The OTP entry step heading (rendered only after a code is sent). */
  otpHeading: /הזנת קוד|קוד אימות|verification|enter.*code/i,
  /** The OTP confirm/login button. */
  verify: /אישור והתחברות|verify|אימות|המשך/i,
} as const;
