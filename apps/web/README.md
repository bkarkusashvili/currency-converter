# Web

React 19 + Vite + TypeScript client for the currency converter API. Routes:
`/` converter (form, result card, recent conversions) and `/about` (what was
built and why, with a live health check).

## Scripts

```bash
npm ci
npm run dev            # vite dev server on :5173
npm run build          # tsc -b && vite build
npm run preview        # serve the production build
npm run lint           # eslint
npm run typecheck      # tsc -b
npm run format         # prettier --write
npm run format:check   # prettier --check (the gate CI runs)
npm test               # vitest
npm run test:coverage  # vitest with coverage thresholds (90%)
```

## Layout

```
src/
├── api/
│   ├── http/           fetch client, ApiError and envelope mapping
│   ├── repositories/   one interface per resource + HTTP implementations, React context
│   └── hooks/          useConvert, useCurrencies, useHistory, useHealth
├── components/         shell and cross-feature presentation
├── features/
│   ├── about/          components/, __tests__/
│   └── converter/      components/, hooks/, lib/, __tests__/
├── i18n/               en.json, i18next setup, key typings
├── lib/                formatters and external links
└── test/               setup, render helper, in-memory repository fakes
```

Components depend on the repository interfaces, never on the HTTP client. The
provider is wired to the HTTP implementations in `main.tsx`; tests inject
in-memory fakes through the same provider, so nothing in the suite touches the
network.

## Internationalisation

Every user-facing string lives in `src/i18n/en.json` and is read through
`react-i18next`. `src/i18n/i18next.d.ts` augments `CustomTypeOptions`, so a key
that is not in the dictionary fails `npm run typecheck`. Number and date
formatting goes through `Intl` with the active language (`src/lib/useFormatters.ts`).

Adding a language is a new JSON file next to `en.json`, a line in `resources`
and a language switch — no component changes.

API failures are shown by mapping the envelope `code` to a translated message,
falling back to the server `message` for a code this client does not know.
Field messages from `details.errors` are shown exactly as the server returned
them; the ones naming `amount`, `from` or `to` are routed onto that input.

## Runtime configuration

The API URL is read at runtime, not baked into the bundle. `public/config.js`
sets it and `index.html` loads it before the bundle:

```js
window.__APP_CONFIG__ = { apiUrl: 'http://localhost:3000' };
```

`src/config.ts` reads it through a typed accessor and falls back to
`http://localhost:3000`. To point the dev server at another API, edit
`public/config.js`.

## Docker

```bash
docker build -t currency-web:local .
docker run --rm -e API_URL=https://api.example.com -e PORT=8080 -p 8080:8080 currency-web:local
```

The image builds with `node:24-alpine` and serves the bundle with
`nginx:alpine`. At container start an entrypoint script rewrites `config.js`
from `API_URL` (default `http://localhost:3000`, JSON-escaped so a quote in the
URL cannot break the file) and nginx renders its config from a template
listening on `PORT` (default `80`), with SPA fallback, gzip, long-lived caching
for hashed assets and no caching for `index.html` and `config.js`. Every
location includes `nginx/security-headers.conf`, which sends
`X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin` and `X-Frame-Options: DENY`; nginx replaces
inherited `add_header` directives instead of merging them, so the set lives in
one file that each location includes.

The image declares no `EXPOSE`: the listening port is whatever `PORT` is set
to, so publish that port (`-p 8080:8080` above).
