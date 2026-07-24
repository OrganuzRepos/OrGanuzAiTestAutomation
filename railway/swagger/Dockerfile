# Scalar API reference (static) — Railway build.
# Build context = repo root; Dockerfile Path = railway/swagger/Dockerfile.
#
# The official nginx image runs everything in /docker-entrypoint.d at startup:
#   - 20-envsubst-on-templates.sh renders *.template in /etc/nginx/templates,
#     so default.conf.template's ${PORT} is substituted (Railway sets PORT).
#   - our 40-scalar-url.sh renders index.html from index.html.template with the
#     public API URL (${API_PUBLIC_URL}) the browser fetches /openapi.json from.
FROM nginx:1.27-alpine

# The Scalar page is rendered from a template at runtime, so ship only the
# template (index.html is generated into place by 40-scalar-url.sh).
COPY railway/swagger/index.html.template /usr/share/nginx/html/index.html.template
COPY railway/swagger/default.conf.template /etc/nginx/templates/default.conf.template
COPY railway/swagger/40-scalar-url.sh /docker-entrypoint.d/40-scalar-url.sh
RUN chmod +x /docker-entrypoint.d/40-scalar-url.sh

ENV PORT=80
EXPOSE 80
