# Prometheus Pushgateway — Railway build.
# Build context = repo root; Dockerfile Path = railway/pushgateway/Dockerfile.
#
# Public service: CI (GitHub Actions, external to Railway) pushes qa_playwright_*
# metrics here via scripts/push-qa-metrics.mjs, so point PUSHGATEWAY_URL in CI at
# this service's public Railway domain. Listens on a fixed 9091 so Prometheus can
# scrape it internally at pushgateway.railway.internal:9091.
#
# SECURITY: the Pushgateway has no built-in auth. A public one lets anyone push
# metrics. See railway/README.md for adding a basic-auth reverse proxy.
FROM prom/pushgateway:v1.10.0

EXPOSE 9091
# Default entrypoint already listens on :9091; kept explicit for clarity.
CMD ["--web.listen-address=:9091"]
