#!/bin/sh
# Regenerates the runtime config the SPA reads, so one image serves any API URL.
set -eu

API_URL="${API_URL:-http://localhost:3000}"

printf "window.__APP_CONFIG__ = { apiUrl: '%s' };\n" "$API_URL" \
  > /usr/share/nginx/html/config.js

echo "app config written: apiUrl=$API_URL"
