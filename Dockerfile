# One image for every role: api+worker together (deploy/app-entrypoint.sh runs migrations, then both)
# and web. Build arg NPM_REGISTRY switches the npm registry (e.g. https://registry.npmmirror.com in
# mainland China).
FROM node:24-trixie-slim AS base
WORKDIR /app
# pg_dump for the optional database backups (works against PostgreSQL 17; a newer server's dump may need
# a matching client instead). tini is PID 1: it reaps zombies and forwards docker stop's SIGTERM to the
# entrypoint, which the "app" role (api+worker in one container) needs to shut both down together.
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

FROM base AS build
ARG NPM_REGISTRY=
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/backend/package.json packages/backend/
COPY packages/contracts/package.json packages/contracts/
COPY industry/package.json industry/
COPY site/package.json site/
COPY modules/aihot-bridge/package.json modules/aihot-bridge/
COPY modules/fomo/package.json modules/fomo/
COPY modules/leaderboard/package.json modules/leaderboard/
COPY modules/quiz/package.json modules/quiz/
COPY modules/services/package.json modules/services/
RUN npm ci --no-audit --no-fund ${NPM_REGISTRY:+--registry=$NPM_REGISTRY}
COPY . .
RUN npm run build -w @aihot/web && npm prune --omit=dev --no-audit --no-fund

FROM base
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
# tini forwards docker stop's SIGTERM instead of ignoring it (the default for PID 1 running a shell).
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/web/server.ts"]
