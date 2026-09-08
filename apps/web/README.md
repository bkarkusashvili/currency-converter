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
npm test               # vitest
npm run test:coverage  # vitest with a coverage report
npm run format         # prettier --check
```

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
from `API_URL` (default `http://localhost:3000`) and nginx renders its config
from a template listening on `PORT` (default `80`), with SPA fallback, gzip,
long-lived caching for hashed assets and no caching for `index.html` and
`config.js`.
