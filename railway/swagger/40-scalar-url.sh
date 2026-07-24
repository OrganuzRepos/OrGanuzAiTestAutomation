#!/bin/sh
# Render the Scalar page at container start, injecting the PUBLIC api URL the
# browser will fetch /openapi.json from. Runs via nginx's /docker-entrypoint.d.
set -e

: "${API_PUBLIC_URL:=http://localhost:8000}"
export API_PUBLIC_URL

envsubst '${API_PUBLIC_URL}' \
  < /usr/share/nginx/html/index.html.template \
  > /usr/share/nginx/html/index.html
