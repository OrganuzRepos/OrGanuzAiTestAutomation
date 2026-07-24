# Deploying the QA dashboard stack on Railway

This directory hosts the **full monitoring stack** from `docker-compose.yml` on
[Railway](https://railway.app), as **six independent Railway services** in one
project, wired over Railway's private network. Railway does **not** read
`docker-compose.yml` — each compose service becomes its own Railway service with
its own Dockerfile here.

The one-shot `tests` compose service is intentionally **not** ported: it runs
Playwright + browsers and exits, which is a CI job, not a hosted service. It
stays in GitHub Actions (`.github/workflows/parallel-tests.yml`) and pushes
metrics to the hosted Pushgateway (see [CI wiring](#ci-wiring)).

## Services

| Service      | Dockerfile                        | Port | Public? | Volume            |
|--------------|-----------------------------------|------|---------|-------------------|
| `api`        | `railway/api/Dockerfile`          | 8000 | yes\*   | —                 |
| `swagger`    | `railway/swagger/Dockerfile`      | 80   | yes     | —                 |
| `allure`     | `railway/allure/Dockerfile`       | 80   | yes     | —                 |
| `pushgateway`| `railway/pushgateway/Dockerfile`  | 9091 | yes     | —                 |
| `prometheus` | `railway/prometheus/Dockerfile`   | 9090 | no      | `/prometheus`     |
| `grafana`    | `railway/grafana/Dockerfile`      | 3000 | yes     | `/var/lib/grafana`|

\* `api` needs a public domain only because the browser-side Scalar UI (`swagger`)
fetches `/openapi.json` from it. If you don't need the Scalar UI you can make
`api` private.

**Service names matter.** The private hostnames are derived from the service
names (`<name>.railway.internal`). The baked configs assume exactly these names:
`api`, `pushgateway`, `prometheus`. If you name them differently, update
`railway/prometheus/prometheus.railway.yml` and
`railway/grafana/datasource.railway.yml`.

## One-time setup per service

For **every** service, in the Railway dashboard → service → Settings:

1. **Source**: this GitHub repo.
2. **Root Directory**: `/` (repo root — the Dockerfiles `COPY` from repo paths
   like `server/app`, so the build context must be the repo root).
3. **Build → Dockerfile Path**: `railway/<service>/Dockerfile` (from the table).
4. **Networking → Private Networking**: enabled (default). Add a **public domain**
   only for the services marked "Public" above.
5. Set the port Railway targets to match the table (Railway usually detects the
   `EXPOSE`d port; set it explicitly if not).

### Per-service variables & volumes

- **`api`**
  - `PORT=8000` (fixed, so Prometheus can scrape `api.railway.internal:8000`).
  - `CORS_ALLOW_ORIGINS=https://<your-swagger-domain>` — the public Scalar origin
    (comma-separated for several). Consumed by `server/app/main.py`.
- **`swagger`**
  - `API_PUBLIC_URL=https://<your-api-domain>` — where the browser fetches
    `/openapi.json`. Must match a value in the api's `CORS_ALLOW_ORIGINS`.
- **`pushgateway`** — none. (See [security](#security-the-public-pushgateway).)
- **`prometheus`**
  - Attach a **Volume** mounted at `/prometheus` (TSDB persistence).
- **`grafana`**
  - Attach a **Volume** mounted at `/var/lib/grafana`.
  - `GF_SECURITY_ADMIN_PASSWORD=<a real password>` (do **not** keep the local
    `admin`/`admin`). `GF_SECURITY_ADMIN_USER` optional.

## Deploy order

Railway builds all services in parallel; the app-level dependencies resolve at
runtime (Prometheus retries scrapes, Grafana retries the datasource), so strict
ordering isn't required. If you prefer: bring up `api` + `pushgateway` first,
then `prometheus`, then `grafana`, then `swagger` + `allure`.

## CI wiring

Point the GitHub Actions run at the hosted Pushgateway so dashboards fill from CI
runs. In `parallel-tests.yml` (the step that runs `scripts/push-qa-metrics.mjs`),
set:

```
PUSHGATEWAY_URL=https://<your-pushgateway-domain>
```

as a repo secret/variable. The script defaults to `http://localhost:9091` and is
non-fatal if the gateway is unreachable, so this is a safe, additive change.

## The Allure service is a build-time snapshot

`railway/allure/Dockerfile` bakes `./allure-report` into the image, so the hosted
report reflects the report **at image build time**. Allure is regenerated every
test run, so to refresh it you must redeploy the `allure` service after a run
(e.g. a CI step `railway up --service allure` using a Railway token). If you'd
rather it update automatically, host Allure on GitHub Pages instead and drop this
service — the rest of the stack is unaffected.

## Security: the public Pushgateway

The Prometheus Pushgateway has **no authentication**. A public one lets anyone on
the internet push (or clear) metrics. Options:

- **Lowest effort:** accept it — the data is only QA test counts, no secrets.
- **Better:** put a tiny basic-auth reverse proxy (nginx/Caddy) in front as a 7th
  service, make only the proxy public, keep the Pushgateway private, and send the
  credentials from CI. Prometheus still scrapes the Pushgateway privately.

## Alternative: skip Railway, use Grafana Cloud

`server/prometheus.yml` already has a commented `remote_write` block for shipping
metrics to Grafana Cloud (free tier). That renders the same dashboards with no
services for you to host. Lower effort than this full stack if all you want is the
dashboard — see the "Hosting Grafana externally" section of the root `Readme.md`.

## Notes on parity

This is a **deployment target**, not a change to the local stack — `docker-compose
up` and `npm run` are unchanged. The only source change made for Railway is that
`server/app/main.py` now reads CORS origins from `CORS_ALLOW_ORIGINS` (defaulting
to the local `:8080` origins), so the local stack behaves exactly as before.
