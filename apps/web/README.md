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
│   ├── services/       services.ts (one interface per resource + the aggregate),
│   │                   createHttpServices.ts, React context, provider and hook
│   ├── persistence/    the query client and its localStorage persister
│   ├── hooks/          useConvert, useCurrencies, useRatesSnapshot, useHistory,
│   │                   useHealth, useClearRatesCache
│   └── index.ts        what the rest of the app may import from api/
├── components/         shell and cross-feature presentation (+ index.ts)
├── features/
│   ├── about/          components/, hooks/, __tests__/, index.ts
│   ├── converter/      components/, hooks/, lib/ (with lib/amount/), __tests__/, index.ts
│   └── ops/            components/, hooks/, lib/, __tests__/, index.ts
├── i18n/               en.json, i18next setup, key typings (index.ts)
├── lib/                formatters, hooks and external links (+ index.ts)
├── theme/              the preference, its storage and the pre-paint script (+ index.ts)
└── test/               setup, render helper, in-memory service fakes
```

Components depend on the service interfaces, never on the HTTP client. The
provider is wired to the HTTP implementations in `main.tsx`; tests inject
in-memory fakes through the same provider, so nothing in the suite touches the
network. They are called services rather than repositories because this side
stores nothing — the API keeps the Repository pattern, where the stores are.

Each folder above publishes an `index.ts` and that is the only way in from
outside it: a feature imports `../../api`, never `../../api/http/request`.
`no-restricted-imports` in `eslint.config.js` fails the build otherwise.

**State.** TanStack Query owns server state (with persistence for rates and
currencies); React context provides the service implementations (swapped for
fakes in tests); form state is local to the converter; there is no global store
because no client state is shared beyond the query cache.

## The amount field

`features/converter/lib/amount/formatAmountInput.ts` is the one rule for what
the field may hold. Every edit — a keystroke, a paste, a drop — goes through it:
anything that is not a digit or the active locale's decimal separator is
dropped, the integer part is capped at the width of the API's maximum, at most
two decimals survive, thousands are grouped with the separator `Intl` reports
for the language, and the caret is placed after the same number of significant
characters it had passed, so typing inside a grouped number does not throw it
to the end. Backspace and Delete landing on a group separator take the digit
beside it, which the regrouping would otherwise restore.

It decides what may be _typed_, not what an amount _means_: `parseAmount` is
still the single rule for that, and it is what answers `Amount must be
1,000,000,000,000 or less.`

The two do not read the same string, so `canonicalAmount` — in the same file,
because it exists to read that file's own output back — stands between them: it drops the group mark, normalises the decimal mark to `.` and drops a
decimal mark with nothing behind it, and the form parses that. It is what keeps
`12.` submitted with Enter — which never blurs — from being read as no number
at all, and what stops the `1.234` the field writes for 1234 in a
`.`-grouping locale from being read as 1.234. Blur still trims a dangling
separator, but only so the field looks finished.

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

## Warnings

A `warnings` array on a `200` is the API saying what degraded while it answered
(`docs/architecture.md` §3) — the cache it could not reach, the history record
it could not write. It is a footnote on an answer, not a failure, so it renders
as warn-tone notes at the foot of the result card, and as one line under the
form for the ones `/currencies` and `/rates` carry, deduplicated by code.
`src/i18n/warningMessageKey.ts` maps a code to a translated sentence and falls
back to the server's own for a code this client has not been taught, exactly as
the error envelope does. Absent means nothing to say, which is the usual case.

## Offline fallback

The API answers from a stale Redis copy when Monobank is down. This client does
the same one layer out: the `rates` and `currencies` queries are persisted to
`localStorage` through `@tanstack/react-query-persist-client`, with a seven-day
`maxAge` and the package version as the buster, so a release that changes the
API contract discards what the previous one wrote. Every storage call is
guarded — a browser that blocks site data gets the plain in-memory client and
loses only the fallback.

When a conversion fails with `NETWORK_ERROR` or a 5xx, `useConvertWithFallback`
re-prices it from the persisted snapshot with `features/converter/lib/convertOffline.ts`,
a pure implementation of the conversion rules in `docs/architecture.md` §5 on a
`big.js` constructor configured like the API's `Money` — its own `DP`, so a
global that something else set cannot change a rate — and the number matches
what the API would have answered from the same rates. The result card badges it `offline estimate` and says how old the rates
are. Everything the API can answer — validation, an unsupported currency, no
rate path, 401, 404, 429 — is shown as the API answered it, and an estimate is
never added to the history, which is the API's record of what it converted. To
see it: load the page once, stop the API (or set devtools' Network tab to
Offline), and convert again.

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
strict-origin-when-cross-origin`, `X-Frame-Options: DENY` and the policy
below; nginx replaces inherited `add_header` directives instead of merging
them, so the set lives in one file that each location includes.

The image declares no `EXPOSE`: the listening port is whatever `PORT` is set
to, so publish that port (`-p 8080:8080` above).

### Content-Security-Policy

Strict enough that everything the page loads has to be named:

| Directive                                                  | Value                                  | What it is                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `default-src`                                              | `'self'`                               | the floor for anything no later directive names                                                                                                                                                                                                                    |
| `script-src`                                               | `'self' 'sha256-…'`                    | the bundle and `config.js`, both same-origin, plus one hash: the theme script `index.html` runs before the first paint. There is no `unsafe-inline`, so that script runs only while its hash matches its own bytes.                                                |
| `style-src`                                                | `'self' https://fonts.googleapis.com`  | the built stylesheet and the Google Fonts sheet the page links. Tailwind ships a file rather than a runtime, so no `unsafe-inline` is needed; the one style the app sets at runtime (the swap glyph's rotation) goes through the CSSOM, which CSP does not police. |
| `font-src`                                                 | `'self' https://fonts.gstatic.com`     | the font files that sheet pulls                                                                                                                                                                                                                                    |
| `img-src`                                                  | `'self' data:`                         | the favicon, and data URIs for anything inlined                                                                                                                                                                                                                    |
| `connect-src`                                              | `'self'` and the API's origin          | the one host this client talks to                                                                                                                                                                                                                                  |
| `object-src`, `base-uri`, `form-action`, `frame-ancestors` | `'none'`, `'self'`, `'self'`, `'none'` | no plugins, no rewritten base URL, no cross-origin form post, and no framing at all — the last is `X-Frame-Options` again for browsers that predate it                                                                                                             |

`connect-src` is why the file is a template rather than a static snippet:
`docker/40-write-app-config.sh` renders `${CSP_API_ORIGIN}` into it at
container start from the same `API_URL` it writes `config.js` from, so
pointing the image at another API moves the policy with it. Only the origin
survives — everything from the third slash on is dropped, along with every
character an origin cannot contain, so `API_URL` cannot end the header early
and append a directive of its own.

The `script-src` hash covers the theme script byte for byte (Vite copies the
tag through untouched, so the served bytes are the repository's bytes).
`src/theme/__tests__/prePaintScript.test.ts` recomputes it from `index.html`
and fails when the two part company, which is what stops an edit to the script
from silently turning the theme's first paint off in the container.
