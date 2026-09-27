/**
 * Endpoint client for the fraud / account-takeover suite.
 *
 * One method per endpoint the specs exercise — the app origin (`config.app.baseUrl`) and
 * the resolved auth/RPC backend. Every method performs the request and returns a
 * {@link ParsedResponse} (body already read + parsed), so specs assert on
 * `res.status` / `res.headers` / `res.json` / `res.text` without re-reading the body.
 *
 * Non-destructive: callers pass fabricated identities (see target `FAKE`) and the client
 * never triggers an OTP send — only verify/read paths.
 */
import type { APIRequestContext } from '@playwright/test';
import { parseResponse, type ParsedResponse } from '../../../src/api';
import {
  APP,
  AUTH,
  OTP_VERIFY_CALL,
  BACKEND_SKIP_REASON,
  rpcBody,
  looksLikeHtml,
} from './target';

const FORM_HEADERS = { 'content-type': 'application/x-www-form-urlencoded' } as const;
const CANARY_TIMEOUT_MS = 15_000;

export class FraudApi {
  constructor(private readonly request: APIRequestContext) {}

  // ---- App origin -----------------------------------------------------------
  /** GET the app origin's initial document. */
  async appDocument(): Promise<ParsedResponse> {
    return parseResponse(await this.request.get(APP.origin + '/', { failOnStatusCode: false }));
  }

  /** GET the plain-HTTP variant of the app origin (no redirect follow). Null on connection refusal. */
  async appOverHttp(): Promise<ParsedResponse | null> {
    const httpUrl = APP.origin.replace(/^https:/i, 'http:');
    const res = await this.request
      .get(httpUrl, { maxRedirects: 0, failOnStatusCode: false })
      .catch(() => null);
    return res ? parseResponse(res) : null;
  }

  /** GET the app origin with a `q` query param (reflected-XSS probe). */
  async appWithQuery(query: string): Promise<ParsedResponse> {
    return parseResponse(
      await this.request.get(`${APP.origin}/?q=${encodeURIComponent(query)}`, { failOnStatusCode: false }),
    );
  }

  /** CORS preflight (OPTIONS) against the app origin from the given Origin. */
  async appPreflight(origin: string): Promise<ParsedResponse> {
    return parseResponse(
      await this.request.fetch(APP.origin + '/', {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization',
        },
        failOnStatusCode: false,
      }),
    );
  }

  // ---- Auth / RPC backend ---------------------------------------------------
  /** POST an RPC call to the auth backend in the `action=token&token=&call=` envelope. */
  async authRpc(
    call: string,
    extra: Record<string, string> = {},
    token: string = AUTH.publicToken,
    timeoutMs?: number,
  ): Promise<ParsedResponse> {
    return parseResponse(
      await this.request.post(AUTH.baseUrl + '/', {
        headers: FORM_HEADERS,
        data: rpcBody(call, extra, token),
        failOnStatusCode: false,
        ...(timeoutMs ? { timeout: timeoutMs } : {}),
      }),
    );
  }

  /** Verify an OTP for a (fabricated) phone. Never sends an OTP — verify path only. */
  async authOtpVerify(phone: string, code: string): Promise<ParsedResponse> {
    if (!code.trim()) throw new Error('OTP verification requires a non-empty code; refusing an SMS send.');
    return this.authRpc(OTP_VERIFY_CALL, {
      sms_phone: phone.replace(/\D/g, ''),
      sms_code: code,
      regulations_approval: 'YN_ANSWER_NO',
    });
  }

  /** POST a raw (malformed) body to the auth backend — error-hygiene probe. */
  async authRaw(body: string): Promise<ParsedResponse> {
    return parseResponse(
      await this.request.post(AUTH.baseUrl + '/', { headers: FORM_HEADERS, data: body, failOnStatusCode: false }),
    );
  }

  /** CORS preflight (OPTIONS) against the auth backend from the given Origin. */
  async authPreflight(origin: string): Promise<ParsedResponse> {
    return parseResponse(
      await this.request.fetch(AUTH.baseUrl + '/', {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
        failOnStatusCode: false,
      }),
    );
  }

  /**
   * Reachability canary. Returns a skip reason when the auth backend is unreachable or
   * serves an HTML block/challenge page to the runner; '' when it answers as an API.
   */
  async authBlockReason(): Promise<string> {
    try {
      const res = await this.authRpc('__qa_fraud_canary__', {}, AUTH.publicToken, CANARY_TIMEOUT_MS);
      return looksLikeHtml(res.contentType, res.text) ? BACKEND_SKIP_REASON : '';
    } catch {
      return BACKEND_SKIP_REASON;
    }
  }
}
