/**
 * Read a one-time login code out of the SMS that the product app sends on a real (non-dev)
 * login, via the Twilio REST API. Dev uses a fixed OTP (7777) and needs no SMS; production
 * (and any env wired to send a live SMS) delivers the code to a Twilio number, and this
 * helper polls Twilio's inbound-messages endpoint for it.
 *
 * Credentials are Restricted and live only in the gitignored env files (never committed):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and optionally TWILIO_OTP_NUMBER (the Twilio
 *   number that receives the code, if it differs from the login phone). See env/README.md.
 *
 * No SDK: a single authenticated GET keeps the dependency surface flat and matches the
 * repo's browserless APIRequestContext / fetch style.
 */

const trimmedEnv = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
};

/** True when both Twilio credentials are present — otherwise SMS reading is unavailable. */
export function twilioConfigured(): boolean {
  return Boolean(trimmedEnv('TWILIO_ACCOUNT_SID') && trimmedEnv('TWILIO_AUTH_TOKEN'));
}

/**
 * Normalize a phone number to E.164, the format Twilio stores. Passes through numbers that
 * already start with '+'; maps an Israeli national number (leading 0) to +972. Any other
 * shape is returned as-is (already-normalized or a foreign number set explicitly).
 */
export function toE164(raw: string): string {
  const digits = raw.replace(/[\s-()]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return digits;
}

interface TwilioMessage {
  readonly body: string | null;
  readonly date_sent: string | null;
  readonly date_created: string | null;
  readonly direction: string | null;
  readonly to: string | null;
  readonly from: string | null;
}

/** Extract an N-digit code from an SMS body — a labelled code first, then a bare run. */
function extractCode(body: string, digits: number): string | undefined {
  const labelled = new RegExp(`(?:קוד|code|otp|אימות|verification)\\D{0,24}(\\d{${digits}})`, 'i');
  const bare = new RegExp(`(?<!\\d)(\\d{${digits}})(?!\\d)`);
  return labelled.exec(body)?.[1] ?? bare.exec(body)?.[1];
}

async function listMessagesTo(toNumber: string): Promise<TwilioMessage[]> {
  const sid = trimmedEnv('TWILIO_ACCOUNT_SID');
  const token = trimmedEnv('TWILIO_AUTH_TOKEN');
  if (!sid || !token) return [];

  const url = new URL(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`);
  url.searchParams.set('To', toNumber);
  url.searchParams.set('PageSize', '20');

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!response.ok) return [];
  const data = (await response.json()) as { messages?: TwilioMessage[] };
  return data.messages ?? [];
}

const messageTime = (message: TwilioMessage): number =>
  Date.parse(message.date_sent ?? message.date_created ?? '');

export interface FetchOtpOptions {
  /** The number that RECEIVES the SMS (the login phone / a Twilio number), any format. */
  readonly toNumber: string;
  /** Only accept messages at/after this epoch-ms (the moment the code was requested). */
  readonly sinceMs: number;
  /** Give up after this long (default 90s — carrier + Twilio delivery can lag). */
  readonly timeoutMs?: number;
  /** Poll interval (default 3s). */
  readonly pollMs?: number;
  /** OTP length (default 4 — the product uses four single-digit boxes). */
  readonly digits?: number;
}

/**
 * Poll Twilio for the newest inbound SMS to `toNumber` sent at/after `sinceMs` and return
 * the extracted code, or `undefined` if none arrives before `timeoutMs`. A small look-back
 * margin absorbs clock skew between the runner and Twilio so the just-sent code is not
 * dropped. Never throws on a transient API hiccup — it simply retries until the deadline.
 */
export async function fetchOtpFromSms(options: FetchOtpOptions): Promise<string | undefined> {
  const to = toE164(options.toNumber);
  const timeoutMs = options.timeoutMs ?? 90_000;
  const pollMs = options.pollMs ?? 3_000;
  const digits = options.digits ?? 4;
  const floor = options.sinceMs - 15_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const messages = await listMessagesTo(to).catch(() => [] as TwilioMessage[]);
    const candidates = messages
      .filter((message) => {
        const time = messageTime(message);
        return Number.isFinite(time) && time >= floor && (message.direction ?? 'inbound').includes('inbound');
      })
      .sort((a, b) => messageTime(b) - messageTime(a));

    for (const message of candidates) {
      const code = extractCode(message.body ?? '', digits);
      if (code) return code;
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return undefined;
}
