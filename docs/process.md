# How this was built

The design contract is [`architecture.md`](architecture.md); what is built
against it is in [`README.md`](../README.md). This document is the third thing a
reviewer might reasonably ask for: how the work was actually done — the order,
the loop each change went through, what that loop caught, and where the process
is weaker than it looks.

## Stages

Each stage is a set of pull requests. Every one that has merged, merged into
`main` green, and nothing was pushed to `main` directly. Two of stage 9's three
were still open when this was written — the pull request numbers below name them
either way, so the table is a map of the work rather than a claim about what has
landed.

| # | Stage | Landed as |
| - | ----- | --------- |
| 1 | **The contract first.** `docs/architecture.md` — module layout, API contract, caching and resilience model, error envelope, configuration surface, testing strategy — written and committed before any implementation code. Every pull request after it was reviewed against it, and behaviour that changed changed the document in the same pull request. | the bootstrap commit |
| 2 | **Two foundations, in parallel.** The NestJS skeleton (config schema, logging, error envelope, health) and the React client (converter, history, reviewer page, Docker) were built at the same time against §3 rather than against each other, because the contract already said what one would send and the other would receive. | #1, #2 |
| 3 | **Stacked feature pull requests.** Rates (Monobank provider, retry, circuit breaker, Redis cache-aside), then conversion (strategy chain, `big.js` money), then history (MongoDB store, `GET /history`) — each stacked on the last, plus the Compose stack and Railway config alongside. | #3, #4, #5, #7 |
| 4 | **Offline fallback and a UX pass.** The persisted rates snapshot and the browser-side estimate, then the amount field, result card, states and accessibility work on top of it. | #6, #8 |
| 5 | **Polish, docs, consolidation.** API edges and one validation message; the README, traceability table and reviewer page; then a consolidation pass that merged small files, pulled the two implementations of §5 onto one shared fixture set, and added the container-backed integration suites. | #9, #10, #11, #12 |
| 6 | **The history rewrite.** The commit history was condensed to one commit per pull request, so the log reads as the decision record it is rather than as the sequence of fix rounds that produced it. The review record on the pull requests is untouched, and is where the fix rounds still live. | a rewrite of `main` |
| 7 | **Naming and boundaries.** NestJS file-naming conventions across both apps, an `index.ts` public surface per API module and per top-level web folder, and `no-restricted-imports` failing the build on an import that reaches inside one. | #13 |
| 8 | **The fourth tier.** A daily rate-snapshot archive in MongoDB behind both Redis keys, `GET /rates/history` reading it, and two follow-ups an audit and a browser found. | #14, #16, #19 |
| 9 | **The design pass.** The interface was designed on a Claude Design canvas first — tokens, both themes, every state at 1280 and 360 — and the boards were then implemented as three stacked pull requests: shell and theme switcher; searchable combobox and the `/ops` page; the archive source badge and the rate-history panel. Each pull request lists the boards it implements and the deviations it took from them, with the reason. | #15, #17, #18 |
| 10 | **Final audits.** Five read-only passes over the merged result, each opening its own pull request only where it found something. | see below |

## The loop on every pull request

1. **Implement** against the spec for that pull request, with the gates run
   locally before pushing: lint, format, typecheck, build, both test suites.
2. **Review** — a separate pass over the diff that verifies the claims rather
   than reading them, and posts **line-anchored comments** on the lines they
   concern. Reproduction, not suspicion: the findings quoted below each name
   what was measured.
3. **Fix round** — commits answering the findings, one comment at a time, and a
   second review pass confirming each on the head commit. One pull request took
   three.
4. **CI green** — the three jobs on every pull request: `api` and `web` each run
   lint, format check, typecheck, build, unit tests with coverage gates, `npm
   audit` and a `docker build`; `orchestration` validates the shared fixtures and
   both Compose files, boots the whole stack and probes it, and runs the
   integration suites against the Redis and MongoDB it just started.
5. **Merge** by the author.

**Approval was not available.** GitHub does not let you approve your own pull
request, so no pull request here carries one. What the record carries instead is
the review posts, the line-anchored comments, and the commits that answered them
— all of it public on the pull requests, which is the point: the evidence is the
thread, not a green check somebody could have clicked without reading.

## Audits

Five passes over merged code, each read-only until it had something to say.

| Audit | What it did |
| ----- | ----------- |
| Requirements traceability | Re-derived the README table from the repository rather than from the previous version of the table — one row per atom of the original task, each cited to a path, a test name or a live URL, and each re-verified against the current `main`. |
| Holistic API review | Read the API as one system rather than as the modules it was built in: the module graph one way, the error hierarchy, what every route can answer, what a degraded dependency costs each of them. |
| Fresh-eyes complexity read | A pass with no knowledge of the decisions, asked only where the code is harder to read than the problem is. It is what produced the consolidation pull request and the naming and boundaries one. |
| Docs verification | Every backticked path in the README and the docs resolved against the working tree by script; every claim about a number checked against a fresh run rather than against the last one written down. |
| Final audit | The whole thing once more against the task, the contract and the deployed services, including the honest-limits list — a limitation that had been fixed is a stale document too. |

## Roles

- **The main session** held the orchestration: it wrote the spec for each pull
  request, decided what merged, and never wrote feature code itself.
- **Implementation, review and audit agents** ran on Opus, one per pull request
  or audit, each starting from the spec and the contract rather than from the
  conversation that produced them — which is what makes a review pass a second
  opinion rather than a memory of writing the code. Small mechanical fixes ran
  on Sonnet.
- **The human owner** set the scope and made the decisions the process is not
  entitled to make: MongoDB in the stack, the repository name, Railway as the
  host, the patterns kept because the task asks for them rather than because the
  code needs them, the history rewrite, a no-motion interface, full-width
  controls on the converter. Where a review and an owner decision disagreed, the
  owner decision is what shipped and the pull request says so.

## Numbers

Counts as of **9 September 2026**, from the GitHub API and a fresh run of both
suites on the merge commit this document landed in.

| What | Count |
| ---- | ----- |
| Pull requests opened | 20 |
| …merged into `main` | 17 |
| Commits on `main` | 18 |
| Review posts on those pull requests | 32 |
| Line-anchored review comments | 59 |
| Pull requests that went back for a fix round | 13 |
| Audits over merged code | 5 |
| API tests — unit · end-to-end · integration | 767 · 163 · 25 |
| Client tests | 297 |
| Deploys — API · client, as `railway deployment list` reports them | 12 · 7 |
| Agent runs behind all of the above | roughly 75, as reported by the orchestrating session |

Three pull requests were open when this table was taken: the second and third
of the redesign set, and the one that adds this document. Every count above
moves when they land — the merged, commit, review and client-test rows by the
most — which is the reason the table has a date on it and the reason nothing
else in this document counts anything.

Everything above except the agent runs is recoverable: the pull request, review
and comment counts from the GitHub API's reviews and comments endpoints for each
pull request, the commit count from `git rev-list --count main`, the test counts
from a run of both suites, the deploy counts from the Railway CLI. The agent-run
figure is the one number here with no artefact behind it, and it is approximate
for that reason.


## What the loop caught

Five findings, each from a line-anchored review comment on the pull request that
introduced the code, each reproduced before it was reported.

1. **Redis rejected its own first command.** `lazyConnect: true` with
   `enableOfflineQueue: false` and no eager `connect()` meant the first command
   after boot rejected with `Stream isn't writeable` against a *healthy* Redis —
   reproduced as a first `GET` that rejects and a second, 400 ms later, that
   answers. Every cold start would have missed the cache and failed its first
   save once the rates module landed. Fixed by connecting in `onModuleInit` and
   keeping the offline queue disabled for the genuinely-down case. (#2)
2. **The offline cache erased itself at the moment it was needed.** The persister
   filtered on `status === 'success'`, which excludes a query whose refetch
   failed even though its data is retained, and it rewrites the whole blob on
   every cache event — so the first unreachable refetch emptied the store the
   fallback exists to read. Measured: 15 KB to empty. Fixed by filtering on
   `data !== undefined`. (#6)
3. **The two implementations of §5 had drifted.** The API and the browser each
   carried their own copy of the rates table, and the copies disagreed on two of
   five pairs — so both suites were green about different numbers. Both now read
   `fixtures/rates-snapshot.json` and assert `fixtures/golden-conversions.json`;
   `scripts/check-fixtures.mjs` re-prices all twelve vectors in integer
   arithmetic as a third derivation, which was itself a review finding on the
   pull request that added the script. (#11)
4. **`12.` and Enter failed validation.** The amount field trimmed a dangling
   decimal separator on blur, and Enter submits without blurring — which
   `enterKeyHint="go"` makes the primary path on a phone. The same comment
   thread turned up the worse case behind it: under a locale with `.` as the
   group separator, `1.234` parses as `1.234` rather than `1234`, a silent
   1000× error. Both closed by canonicalising on submit. (#8)
5. **A test that could not fail.** The Mongo integration suite seeded one row
   and asserted one row back, so it passed with and without the limit clamp it
   claimed to cover — verified by deleting the `Math.min` and watching it stay
   green. Reseeded past the maximum, it fails without the clamp. (#11)

## Honest limits of this process

- **No independent human review.** Every review and audit here was performed by
  an agent, and the human in the loop set scope and made decisions rather than
  reading diffs line by line. Nobody outside the project has read this code.
- **Reviewer and author share a model family.** The review agents and the
  implementation agents are the same model, given different instructions and no
  shared context. That removes the memory of having written the code, which is
  most of what makes a second pass useful, but it does not remove a blind spot
  the model has in both roles. A finding neither would make is invisible here in
  a way it would not be to a second person.
- **Counts are as of a date.** The table above is a snapshot, and the prose
  elsewhere is deliberately count-free so it stays true as the numbers move. If
  the two disagree, the table is the one with a date on it.
- **The gates are the ones the project chose.** CI runs what this repository
  asks for. No external scanner, no performance budget, and no browser
  end-to-end layer — that last one is listed as a known limitation in
  [`architecture.md` §14](architecture.md#14-known-limitations-and-follow-ups)
  rather than answered here.
