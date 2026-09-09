#!/bin/sh
# Regenerates the two things the image cannot bake in: the runtime config the
# SPA reads, and the Content-Security-Policy that has to name the same API.
set -eu

API_URL="${API_URL:-http://localhost:3000}"

# JSON-escape the value: a quote or a backslash in the URL must not break the file.
escaped_api_url=$(printf '%s' "$API_URL" | tr -d '\n\r' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

printf 'window.__APP_CONFIG__ = { "apiUrl": "%s" };\n' "$escaped_api_url" \
  > /usr/share/nginx/html/config.js

# `connect-src` takes an origin, not a URL: everything from the third slash on
# is dropped, and every character an origin cannot contain goes with it — a
# quote or a semicolon here would otherwise end the header value early and let
# API_URL write a policy of its own.
CSP_API_ORIGIN=$(printf '%s' "$API_URL" | cut -d/ -f1-3 | sed 's#[^A-Za-z0-9:/.-]##g')
export CSP_API_ORIGIN

envsubst '${CSP_API_ORIGIN}' \
  < /etc/nginx/snippets/security-headers.conf.template \
  > /etc/nginx/snippets/security-headers.conf

echo "app config written: apiUrl=$API_URL"
echo "csp connect-src: 'self' $CSP_API_ORIGIN"
