# Grafana — Railway build.
# Build context = repo root; Dockerfile Path = railway/grafana/Dockerfile.
#
# Reuses the checked-in provisioning (dashboards + dashboard-provider), but
# overrides the datasource with a Railway-specific one that points at the private
# prometheus.railway.internal. Attach a Railway VOLUME mounted at /var/lib/grafana
# to persist Grafana state. Set GF_SECURITY_ADMIN_PASSWORD via Railway variables
# (do NOT ship the compose default "admin").
FROM grafana/grafana:11.3.0

# Dashboards + dashboard provider from the repo.
COPY server/grafana/provisioning/dashboards /etc/grafana/provisioning/dashboards
# Railway-specific datasource (private prometheus URL) — replaces the compose one.
COPY railway/grafana/datasource.railway.yml /etc/grafana/provisioning/datasources/prometheus.yml

# Anonymous read-only viewing, matching the local stack. Admin password must be
# supplied at deploy time via Railway variables.
ENV GF_AUTH_ANONYMOUS_ENABLED=true
ENV GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
ENV GF_SERVER_HTTP_PORT=3000

EXPOSE 3000
