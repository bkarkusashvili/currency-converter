# Currency Converter

Production-style currency converter built on the Monobank public exchange-rate API.

- **API** — NestJS + TypeScript (`apps/api`)
- **Web** — React + Vite + TypeScript (`apps/web`)
- **Cache** — Redis (cache-aside with stale fallback)
- **History** — MongoDB
- **Orchestration** — Docker Compose

See [`docs/architecture.md`](docs/architecture.md) for the design. Full run instructions and API documentation will land here as the implementation progresses.
