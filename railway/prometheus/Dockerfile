# Prometheus — Railway build.
# Build context = repo root; Dockerfile Path = railway/prometheus/Dockerfile.
#
# Uses a Railway-specific config whose scrape targets are *.railway.internal
# private hostnames (vs the compose service names in server/prometheus.yml).
# Attach a Railway VOLUME mounted at /prometheus to persist the TSDB across
# deploys. Internal-only by default (Grafana queries it privately); expose a
# public domain on :9090 only if you want to hit the Prometheus UI.
FROM prom/prometheus:v2.55.1

COPY railway/prometheus/prometheus.railway.yml /etc/prometheus/prometheus.yml

EXPOSE 9090
CMD [ "--config.file=/etc/prometheus/prometheus.yml", \
      "--storage.tsdb.path=/prometheus", \
      "--web.listen-address=0.0.0.0:9090" ]
