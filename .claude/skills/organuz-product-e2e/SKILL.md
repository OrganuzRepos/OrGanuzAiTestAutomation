---
name: organuz-product-e2e
description: Drive or debug the Organuz product calculator (energy/dev app) end-to-end — dev password gate, phone+OTP login, and the multi-step property-characterization wizard. Use when writing/fixing tests/product/** specs or ProductAppPage, or when exploring the dev app with the Playwright MCP.
---

# Organuz product app E2E

> **State:** the **`product` project is ENABLED** (69 discovered tests). The two
> credential-gated role projects (`product-setup` / `product-authenticated`) are still
> commented out in `playwright.config.ts` — see the organuz-product-roles skill.

The product app is a Hebrew (RTL) Vite SPA. Tests live in `tests/product/**` (Playwright project `product`, baseURL = `config.app.baseUrl`, selected by `QA_TARGET_ENV`, default **dev** = `https://dev1.app.organize.organuz.com`). Page object: `tests/product/support/ProductAppPage.ts`. Env gate helper: `tests/product/support/env-gate.ts`.

This skill covers app access, the login UI, the calculator wizard, and MCP driving. **Per-role authentication, session reuse (`product-setup`/`storageState`), the role roster, personal areas, and the role specs are in the organuz-product-roles skill.**

## Environments
- **dev** `dev1.app.organize.organuz.com` · **test** `test.organuz.flamiingo.com` · **prod** `energy.organuz.com`. Map lives in `config.json → environments`.
- Dev/Test sit behind a **shared password gate** (single `סיסמה` field + `כנס` button) before the app loads; prod has none. Password `PRODUCT_PLATFORM_PASSWORD` in the gitignored `.env` (Restricted — from the Organuz Environments doc). Gate success redirects to `…/calculator/address`.

## Login (phone + OTP)
Credentials are Restricted; they live only in the gitignored `.env`. Dev uses a **fixed OTP `7777`** (not a live SMS). The per-role phone roster is in the organuz-product-roles skill; `company-employee` has no phone.

Flow (all Hebrew accessible names):
1. Click `הרשמה / כניסה` to open the login dialog (heading `התחברות`).
2. Fill `textbox "מספר הטלפון הנייד שלך"` with the phone, click `שלחו לי קוד אימות לנייד`.
3. OTP step (heading `הזנת קוד אימות`) has **4 single-digit textboxes** — fill each with one digit of `7777`.
4. Click `אישור והתחברות`. Success: header shows the user (e.g. `אודי כהן, בעל נכס`) + status `ההתחברות עברה בהצלחה!`.

## Calculator wizard (the "characterization" flow)
A 7-step tracker (`list "התקדמות השלבים"`). Heavy lifting is done by AI agents (Solara maps the roof, Kelvin analyses it) — most steps just need the primary **continue button `בוא נמשיך`**. Steps confirmed via the Playwright MCP:

1. **`/calculator/address` — איתור הנכס:** pick a property-type button (`בית פרטי` / `בניין מגורים` / `מבנה מסחרי` / `מבנה חקלאי` / `מבנה ציבורי`); type a Hebrew address into the `combobox` and pick from the `listbox` options (English addresses match loosely — prefer Hebrew, e.g. `הברזל 32 תל אביב`). Then `בוא נמשיך` (disabled until type+address chosen).
2. **`/calculator/address/get-address`:** confirmation `מצאנו את הנכס המבוקש!`; the pin is auto-placed. Click `זהו הנכס המבוקש, אפשר להמשיך` → shows `טוען...` while the satellite roof scan runs (~10–20s), then redirects to `/calculator/roof/<roofId>/marking`. **The `<roofId>` in the URL is a runtime id** (capture it).
3. **`/roof/<id>/marking` — סימון השטח:** AI auto-detects the roof boundary (`הבינה המלאכותית זיהתה את גבול הגג שלך אוטומטית`). Just `בוא נמשיך`.
4. **`/roof/<id>/placement-elements`:** mark roof obstacles (water heaters/AC/chimneys) — optional; `בוא נמשיך` to skip.
5. **`/roof/<id>/type` — מיקום המערכת ובחירת סוג הגג:** pick the roof surface type and mark
   where the system goes. **This is the automation terminus.** The picker and the drawing
   surface live inside the roof editor iframe (`…/iframe/roof/index.html`), which exposes
   no named controls — a test cannot mark a roof deterministically. What IS deterministic:
   this step has its OWN CTA (`סימנתי את השטח הרלוונטי, אפשר להמשיך`, not `בוא נמשיך`), and
   clicking it with nothing marked raises a guard dialog
   (`…יש לבחור את סוג הגג ואת המיקום…`) and the URL stays on `…/type`. Page object:
   `RoofTypeStep` (`roofTypeStep` fixture).
6.–7. **beyond the roof type:** `תוצאות` (results), `הצעות` (offers), `בחירת הצעה` (offer
   selection) — only reachable once a roof is marked, so still undriven by automation.

**The full 7-stage tracker roster** (confirmed live, in `WIZARD.stages`):
`איתור הנכס` · `סימון השטח` · `שאלות נוספות` · `מחשבים` · `תוצאות` · `הצעות` · `בחירת הצעה`.
A **completed** stage turns into a back-navigation button `חזרה לשלב <stage>` — the wizard's
only in-app way back (`StepTracker.goBackToStage`).

Shortcut on every step: `הזמן דוח סולארי עכשיו - הסוכנים שלנו יעשו עבורך הכל` hands the whole flow to Organuz's agents — do NOT click it in tests (it creates a real lead).

## Driving with the Playwright MCP
Load tools once: `ToolSearch "select:mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_type,mcp__playwright__browser_wait_for"`. Navigate → snapshot → act by ref. Refs change after navigation/login, so re-snapshot. The map is an `iframe` (Israel Mapping Center); don't try to read map internals. Wait on `טוען...` going hidden between heavy steps.

## Reusable flows (keep specs short)
Import `test`/`expect` from `tests/product/support/fixtures.ts` to get the `product` fixture (a `ProductFlows`):
- `product.openCalculator()` — goto `/` + unlock the dev gate (used by the smoke `beforeEach`).
- `product.loginAs('customer'|'company'|'consultant')` — phone+OTP login from env creds (also opens the calculator + unlocks the gate). Used by `product-setup` and the isolated `role-logout` spec; per-role specs use `resumeSession` instead (see the organuz-product-roles skill).
- `product.characterizeToRoofType(scenario)` — property type + address → roof scan → auto boundary → obstacles → roof-type step; returns `{ projectId, quotationId(roofId) }`.
- `product.openRoofStep(projectId, roofId, step)` — deep-link straight to a saved project's
  roof step (unlocks the dev gate on the way), so a test can resume an already-characterized
  project instead of replaying the slow, project-creating wizard.
- `product.openPersonalArea()` → `…/pricing/my-offers`. Each saved project is listed with its
  address + `תאריך יצירת הצעה:` and a `לעמוד הפרויקט` CTA that **reopens it back in the
  wizard at the step it was left on, with the same projectId/roofId**. Page object:
  `MyOffersPage` (`myOffers` fixture); selectors in `src/pages/product/accountControls.ts`.

## Full customer journeys (`tests/product/journeys/**`)
Five serial end-to-end journeys, each starting from a signed-in customer:
characterize → find it in the personal area → reopen it → the roof-type guard → tracker
back-navigation → personal-area navigation + sign-out. Gated exactly like the wizard e2e
(`skipGeocodeDrivingOnCi()` + opt-in `PRODUCT_WIZARD_E2E=true` + `skipOnOutage`).
They are **serial** because journey 1 performs the single real login and saves a
**run-scoped** session (`tests/product/support/journeySession.ts` → a file separate from the
shared per-role sessions, so the sign-out journey cannot invalidate them); journeys 2–4
resume it and deep-link to journey 1's project; journey 5 takes a clean context to sign out.
One OTP send per run instead of five.

`ProductFlows` wraps `ProductAppPage` (the low-level step methods). Add new named flows there, not in specs. Keep test-lifecycle logic out of `ProductAppPage`: `login()` throws `OtpUnavailableError` on an OTP rate-limit, and `ProductFlows` (not the page object) turns it into a graceful `test.skip`.

## Roles, sessions & personal areas
Per-role authentication, the `product-setup` storageState reuse, `resumeSession`, the role
roster (customer/consultant/company + company-employee), the personal-area maps, and the role
specs are all in the **organuz-product-roles** skill.

## The 600x800 viewport changes the header and the personal area
The `product` project runs at **600x800** (set in `playwright.config.ts` → `productUse`), which
is a *mobile* layout. Confirmed live — do not write desktop-only selectors:
- The header **user button `<name>, <role>` does not exist**. It collapses into a **nameless
  icon**, and the header bar holds OTHER nameless/named icons too (the wizard's `חזרה` on the
  roof steps, a second icon in the personal area) — so "the first button in `.print_hide`" is
  the wrong control on some pages. `ProductAccountPage.openUserMenu()` therefore clicks the
  header icons in turn and keeps whichever one actually opens the account menu (verified by
  the `איזור אישי` menuitem). Same story for the login CTA — see `LOGIN.mobileLoginEntry`.
- Because the header gives no name, **`isLoggedIn()` relies on the persisted-session signal**
  (`ProductSession` → localStorage `user`), not header text. Assert sign-out with
  `app.isAuthenticated()`, not just "the login CTA is visible" — the icon is there either way.
- The personal area **renders no sidebar** at this width: `/pricing/my-offers` shows only the
  heading, the `סידור הצעות לפי:` sort control, and the offer cards. `openSidebarEntry(...)`
  is a **desktop-only** call — it cannot work in the `product` project.

## Gotchas
- Never use `waitForLoadState('networkidle')` — the embedded map iframe keeps the network perpetually busy. Use `domcontentloaded` or `expect` auto-waiting.
- **Phone field:** use `.fill()` (a single set) — it has an input mask that mangles char-by-char typing. **Address combobox:** the opposite — use `pressSequentially` so the autocomplete fires; then pick the first `option`.
- **OTP rate-limiting:** dev limits OTP sends per phone; hammering one number stops the OTP step from rendering (`הזנת קוד` never appears) until a cooldown. `login()` resends once and is idempotent; when the step never renders it throws `OtpUnavailableError`. The suite avoids the limit by logging each role in once and reusing the saved session — see the organuz-product-roles skill. When exploring live with the MCP, don't hammer one number; personas use different numbers.
- All logged-in roles (customer/consultant/company) land on the calculator address step with the property-type buttons; role differences show up in the header label and the personal-area sidebar (see the organuz-product-roles skill), not on the home screen.
- The full 50-test matrix (`PRODUCT_E2E_ENABLED=true`) creates real projects/quotations on dev; the credential-free `tests/product/smoke` suite is safe and always runnable.
