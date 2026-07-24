# `test_input/` — input folder for the TestPlanAgent

The **TestPlanAgent** can read this folder to generate detailed multi-step **STD**
test plans (one per URL) instead of taking a single URL on the command line:

```bash
npm run agent:plan -- --input            # reads ./test_input
npm run agent:plan -- --input --live     # same, but explores the real pages via Playwright MCP
npm run agent:plan -- --input my_dir     # read a different folder
```

## What it reads

1. **URLs** — the first present of `urls.txt` / `urls.json`:
   - `urls.txt` — one URL per line; blank lines and `#` comments ignored.
   - `urls.json` — a JSON array of strings, or `{ "urls": [ ... ] }`.
2. **Reference screenshots** — every `*.png` / `*.jpg` / `*.jpeg` / `*.webp` / `*.gif`
   directly in this folder **and** in the optional `images/` subfolder. Each image
   is threaded into every generated plan as a **visual-reference case**: the live
   layout is compared against the screenshot within an agreed tolerance.

## Output

For each URL the agent emits a `TestSuite` of STD cases — each with an **objective**,
**preconditions**, a **priority** (P1–P3), and ordered **action → expected** steps —
covering page load, key headings, each navigation link, each form, and (when images
are present) a visual-reference case. The suites print to the console and as JSON.

> Drop your page screenshots into `images/` and add the pages' URLs to `urls.txt`.
> Files here are examples — real reference images can be large, so keep only what you need.
