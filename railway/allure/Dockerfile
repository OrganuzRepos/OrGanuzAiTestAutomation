# Allure report (static) — Railway build.
# Build context = repo root; Dockerfile Path = railway/allure/Dockerfile.
#
# NOTE: the report is baked in at build time, so it reflects whatever was in
# ./allure-report when the image was built. Allure is regenerated every test run,
# so to refresh the hosted report you must rebuild/redeploy this service after a
# run (e.g. a CI step: `railway up --service allure`). If you need it to update
# without a redeploy, host Allure on GitHub Pages instead (see the parallel-tests
# workflow) and drop this service.
FROM nginx:1.27-alpine

COPY allure-report /usr/share/nginx/html
COPY railway/allure/default.conf.template /etc/nginx/templates/default.conf.template

ENV PORT=80
EXPOSE 80
