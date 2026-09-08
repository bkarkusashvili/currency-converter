# syntax=docker/dockerfile:1

# The base is pinned by digest as well as by tag: `node:24-alpine` moves, so two
# builds of the same commit are otherwise two different images, and which one is
# running is not something the commit can answer. The tag is kept beside it
# because it is what says which base this is.
ARG NODE_IMAGE=node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf

# Full dependency tree, including the devDependencies the build needs.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app

# A second, production-only install rather than a copy of the build tree, so no
# devDependency ever reaches the runtime image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000

# Liveness, not readiness: /health answers 503 when any dependency is down, and
# a container that still converts must not be restarted because the conversion
# history is unreachable. /health is the report monitoring reads.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT ?? 3000) + '/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
