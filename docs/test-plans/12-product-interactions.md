# Test Plan 12 — Product Interactive UI

| | |
|---|---|
| **Project** | `product` |
| **Specs** | `tests/product/auth/**`, `tests/product/mobile/**`, `tests/product/wizard/**` |
| **Target** | Product calculator selected by `QA_TARGET_ENV` (dev by default) |
| **Cases** | 24 discovered |
| **Fixtures** | `product`, `loginDialog`, layered step/flow fixtures under `tests/product/support/` |

## Scope

Interactive browser coverage beyond the public API and offline matrix plans:
the cellular login dialog, responsive phone layouts, the calculator
characterization wizard, and the customer process.

## Coverage

| Area | Cases | Notes |
|---|---:|---|
| Cellular login | 9 | Dialog entry, phone validation, registration links, close behavior, and an opt-in OTP step |
| Mobile viewport | 7 | Pixel 5 and Galaxy S9+ shell, overflow, login-dialog fit, plus one opt-in navigation diagnostic |
| Wizard/customer process | 8 | Step tracker, live address/geocode journey, wizard progression, and opt-in authenticated characterization |

## Gating and side effects

- All groups skip on a genuine product-app outage.
- Geocode-driving wizard cases self-skip on CI because Govmap is geo-blocked or
  unstable for hosted runners; deterministic step checks remain CI-enabled.
- `PRODUCT_OTP_UI=true` enables the single check that requests a real OTP.
- `PRODUCT_WIZARD_E2E=true` enables authenticated characterization; it can
  create a real dev project and needs customer credentials.
- `MOBILE_NAV_EXPLORE=true` enables the temporary mobile navigation diagnostic.
- OTP cooldowns produce an explicit skip instead of a false product failure.

## Run

```bash
npx playwright test --project=product tests/product/auth tests/product/mobile tests/product/wizard
PRODUCT_OTP_UI=true npx playwright test --project=product tests/product/auth/cellular-login.spec.ts
PRODUCT_WIZARD_E2E=true npx playwright test --project=product tests/product/wizard
```

