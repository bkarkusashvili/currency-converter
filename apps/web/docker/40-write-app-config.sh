#!/bin/sh
# Regenerates the runtime config the SPA reads, so one image serves any API URL.
set -eu

API_URL="${API_URL:-http://localhost:3000}"

# JSON-escape the value: a quote or a backslash in the URL must not break the file.
escaped_api_url=$(printf '%s' "$API_URL" | tr -d '\n\r' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

printf 'window.__APP_CONFIG__ = { "apiUrl": "%s" };\n' "$escaped_api_url" \
  > /usr/share/nginx/html/config.js

echo "app config written: apiUrl=$API_URL"
