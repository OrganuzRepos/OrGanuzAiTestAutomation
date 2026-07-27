/**
 * Endpoint clients for the external-API monitoring group.
 *
 * One method per distinct endpoint the specs exercise against **Govmap**
 * (`www.govmap.gov.il`) and **Ofek** (`basemaps.govmap.gov.il`). Every method
 * builds its request from the shared `endpoints.ts` helpers, performs it with
 * `failOnStatusCode: false` (the specs assert on status themselves), and returns
 * a {@link ParsedResponse} (body already read + parsed) — so specs read
 * `res.status` / `res.headers` / `res.contentType` / `res.json` / `res.text` /
 * `res.buffer` without re-reading the body. Binary tiles come back on
 * `res.buffer`, never `res.json`.
 */
import type { APIRequestContext } from '@playwright/test';
import { parseResponse, type ParsedResponse } from '../../../src/api';
import { GOVMAP, autocompleteBody, orthoTileUrl, labelTileUrl, TILE_HEADERS } from './endpoints';

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

const JS = `${GOVMAP.apiBaseUrl}/govmap/api/govmap.api.js`;
const AUTOCOMPLETE = `${GOVMAP.apiBaseUrl}/api/search-service/autocomplete`;
const GET_TYPES = `${GOVMAP.apiBaseUrl}/api/search-service/getTypes`;
const AUTH = `${GOVMAP.apiBaseUrl}/api/layers-catalog/api/auth`;
const BASE_LAYERS = `${GOVMAP.apiBaseUrl}/api/layers-catalog/baseLayers?language=he`;
const ME = `${GOVMAP.apiBaseUrl}/api/users-management/me?viewerOnly=1`;
const TRANSLATIONS = `${GOVMAP.apiBaseUrl}/locales/he/translation.json`;
const EMBED = `${GOVMAP.apiBaseUrl}/?b=2&api_token=${GOVMAP.embedToken}&xy=1&in=1&bb=1&zb=1&et=0&lm=4&lang=he`;

/** Govmap map-API + address-search/geocoding client. */
export class GovmapApi {
  constructor(private readonly request: APIRequestContext) {}

  /** GET the `govmap.api.js` map-API loader bundle. */
  async apiScript(): Promise<ParsedResponse> {
    return parseResponse(await this.request.get(JS, { failOnStatusCode: false }));
  }

  /** GET the embedded viewer document for the public embed token. */
  async embedDocument(): Promise<ParsedResponse> {
    return parseResponse(await this.request.get(EMBED, { failOnStatusCode: false }));
  }

  /** POST address autocomplete / geocoding for a search string. */
  async autocomplete(searchText: string): Promise<ParsedResponse> {
    return parseResponse(
      await this.request.post(AUTOCOMPLETE, {
        headers: JSON_HEADERS,
        data: autocompleteBody(searchText),
        failOnStatusCode: false,
      }),
    );
  }

  /** POST the search-service `getTypes` catalogue. */
  async getTypes(): Promise<ParsedResponse> {
    return parseResponse(
      await this.request.post(GET_TYPES, { headers: JSON_HEADERS, data: { language: 'he' }, failOnStatusCode: false }),
    );
  }

  /** POST the layers-catalog auth handshake that binds the embed token to an app origin. */
  async authHandshake(token: string, hostUrl: string): Promise<ParsedResponse> {
    return parseResponse(
      await this.request.post(AUTH, { headers: JSON_HEADERS, data: { token, hostUrl }, failOnStatusCode: false }),
    );
  }

  /** GET the protected base-layers catalogue (expects auth enforcement without a session). */
  async baseLayers(): Promise<ParsedResponse> {
    return parseResponse(await this.request.get(BASE_LAYERS, { failOnStatusCode: false }));
  }

  /** GET the anonymous users-management identity endpoint. */
  async me(): Promise<ParsedResponse> {
    return parseResponse(await this.request.get(ME, { failOnStatusCode: false }));
  }

  /** GET the Hebrew i18n translations bundle. */
  async translations(): Promise<ParsedResponse> {
    return parseResponse(await this.request.get(TRANSLATIONS, { failOnStatusCode: false }));
  }

  /** GET the Govmap API host root (TLS reachability probe). */
  async apiRoot(): Promise<ParsedResponse> {
    return parseResponse(await this.request.get(GOVMAP.apiBaseUrl, { failOnStatusCode: false }));
  }
}

/** Ofek / Survey-of-Israel orthophoto + label tile client. */
export class OfekApi {
  constructor(private readonly request: APIRequestContext) {}

  /** GET an orthophoto (aerial) tile with the required Govmap referer. */
  async orthoTile(z: number, x: number, y: number): Promise<ParsedResponse> {
    return parseResponse(await this.request.get(orthoTileUrl(z, x, y), { headers: TILE_HEADERS, failOnStatusCode: false }));
  }

  /** GET an orthophoto tile with caller-supplied headers (omit for no referer). */
  async orthoTileWithHeaders(z: number, x: number, y: number, headers?: Record<string, string>): Promise<ParsedResponse> {
    return parseResponse(
      await this.request.get(orthoTileUrl(z, x, y), { ...(headers ? { headers } : {}), failOnStatusCode: false }),
    );
  }

  /** GET a label/line overlay tile with the required Govmap referer. */
  async labelTile(z: number, x: number, y: number): Promise<ParsedResponse> {
    return parseResponse(await this.request.get(labelTileUrl(z, x, y), { headers: TILE_HEADERS, failOnStatusCode: false }));
  }

  /** GET a label tile with caller-supplied headers (omit for no referer). */
  async labelTileWithHeaders(z: number, x: number, y: number, headers?: Record<string, string>): Promise<ParsedResponse> {
    return parseResponse(
      await this.request.get(labelTileUrl(z, x, y), { ...(headers ? { headers } : {}), failOnStatusCode: false }),
    );
  }
}
