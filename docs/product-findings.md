# Product findings

Defects in the **product** (not in the tests) found while writing automation. The
suite's job is to catch these, so each one is recorded here with how it was
confirmed and which test pins it — otherwise a finding lives in a chat log, gets
forgotten, and is rediscovered a year later by a customer.

A finding leaves this file when the product is fixed and the test that pins it
goes green. A finding with no test is a finding nobody will notice again; say so
explicitly rather than leaving the column blank.

**Status values:** `open` · `fixed` · `wontfix (reason)` · `unconfirmed on dev`

---

## F-01 — The block/parcel search accepts a block with no parcel

| | |
|---|---|
| **Where** | Calculator wizard, step 1 (`/calculator/address`) → tab **חיפוש לפי גוש/חלקה** |
| **Confirmed** | 2026-09-27, production (`energy.organuz.com`), via Playwright MCP |
| **Pinned by** | `tests/product/wizard/contractor-wizard-e2e.spec.ts` — "the find button stays disabled until both block and parcel are filled" |
| **Status** | open — the test is **RED by design** until this is fixed |

Typing a value into **גוש** (block) alone enables the **מצא** (find) button while
**חלקה** (parcel) is still empty.

An Israeli land parcel is identified by *both* numbers. A block on its own covers
many parcels and does not locate a property, so there is nothing for the find to
resolve to. The control should stay disabled until both fields carry a value.

Who hits it: anyone using the block/parcel tab rather than the address tab — which
is the professional's entry point. A contractor or surveyor works from Tabu
documents, where the pair is how a property is named.

---

## F-02 — Searching a block with no parcel silently erases what you typed

| | |
|---|---|
| **Where** | Same screen as F-01 |
| **Confirmed** | 2026-09-27, production, via Playwright MCP |
| **Pinned by** | `tests/product/wizard/contractor-wizard-e2e.spec.ts` — "submitting a block with no parcel explains itself and preserves the input" |
| **Status** | open — the test is **RED by design** until this is fixed |

Clicking **מצא** in the state F-01 allows:

1. the **גוש** field is cleared,
2. **מצא** returns to disabled,
3. **no error, no toast, no validation text appears anywhere on the page**,
4. **בוא נמשיך** stays disabled.

The user is given no reason. Their input is gone and the screen looks the same as
before they started, so the natural reading is "the site is broken" or "my block
number does not exist" — neither of which is true.

This is the more serious half of the pair. F-01 lets you reach an invalid state;
F-02 is what the product does once you are there, and a silent failure is the
hardest kind for support to diagnose from a ticket: the user has nothing to quote.

Either behaviour alone would be a defect. Together they cost a professional their
input and tell them nothing.

---

## F-03 — Property-type buttons expose no selected state

| | |
|---|---|
| **Where** | Calculator wizard, step 1 — the **מה סוג הנכס?** button group |
| **Confirmed** | 2026-09-27, production, via Playwright MCP accessibility snapshot |
| **Pinned by** | **nothing** — see below |
| **Status** | open, unpinned |

The five property-type buttons (`בית פרטי`, `בניין מגורים`, `מבנה מסחרי`,
`מבנה חקלאי`, `מבנה ציבורי`) carry no `aria-pressed`, no `aria-selected`, and no
`role="radio"` grouping. After clicking one, the accessibility tree is byte-for-byte
what it was before: the choice is conveyed by styling alone.

Consequences, in order:

- A screen-reader user cannot tell which property type is selected, or that the
  click registered at all. This is a WCAG 4.1.2 (Name, Role, Value) failure on a
  required field of the first step.
- It is untestable through the accessibility tree, which is why no test pins it.
  Asserting it would mean a CSS-class selector in a spec, against this repo's
  page-object discipline and its "no raw locators in specs" rule.

The fix makes both problems go away at once: `aria-pressed` on each button (or a
`radiogroup`) is what the assistive tech and the test both need. A test belongs in
the `accessibility` project once the attribute exists.

Worth noting given this repo runs 30 Axe checks against the marketing homepage:
those checks do not cover the product calculator, so this was never in their reach.

---

## How these were found

Driving the live product with the Playwright MCP before writing a line of test
code, to learn the real DOM rather than infer it from the existing page objects.
All three turned up in under ten minutes on step 1 — the one screen every user
sees, and the one with the most existing coverage.

The lesson worth keeping: the existing wizard specs all enter through the
**address** tab, so the block/parcel tab had never been opened by a test. A defect
does not need to be deep to survive; it only needs to sit on a path no test walks.

## A caveat on all three

They were confirmed on **production**, not on dev. The suite targets dev by
default, which sits behind the shared platform password gate. If the block/parcel
tab is absent or behaves differently on dev, F-01 and F-02 need re-confirming there
and their tests may fail for the wrong reason — mark them `unconfirmed on dev`
rather than deleting them.
