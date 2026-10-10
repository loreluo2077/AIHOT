#!/usr/bin/env bash
# Pulls the latest code, rebuilds the image, runs migrations, then restarts the stack.
# Usage: bash deploy/update.sh   (run from anywhere; cd's to the repo root itself)
#
# Order matters: the old app/web are stopped *before* migrations run, because a migration can drop
# tables/columns the old code still expects (see docs/deploy.md's "更新" section). Migrations run here
# as an explicit, visible step (docker compose run) before anything restarts, even though
# deploy/app-entrypoint.sh also runs them on every boot (idempotent — a fresh `docker compose up -d
# --build` with no prior update.sh run still migrates+seeds on its own). If migrations fail, this
# script stops here — do not start the old or new containers on a half-migrated database; fix the
# migration issue first, then re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> git pull"
git pull

echo "==> docker compose build"
docker compose build

echo "==> stopping app/web (old code)"
docker compose stop app web

echo "==> running migrations"
docker compose run --rm --no-deps --entrypoint node app scripts/migrate.ts
echo "==> seeding demo sources"
docker compose run --rm --no-deps --entrypoint node app scripts/seed.ts

echo "==> starting the updated stack"
docker compose up -d

echo "==> done. recent logs:"
docker compose logs --tail 20 app web
