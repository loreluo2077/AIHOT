#!/usr/bin/env bash
# Entrypoint for the "app" role (api + worker in one container). Runs migrations and seeds the demo
# sources once, then starts both processes. On SIGTERM/SIGINT (docker stop sends SIGTERM to tini, PID 1,
# which forwards it here) both children are signaled: the worker's own shutdown handler
# (apps/worker/src/main.ts) lets an in-flight paid model call finish, up to STOP_TIMEOUT_MS (~195s) —
# matching this image's docker-compose stop_grace_period (210s). A plain `cmd & cmd & wait` without the
# trap would not forward the signal and could kill a paid call mid-request.
#
# If either process exits on its own (crash), the other is also stopped and this script exits
# non-zero, so Docker restarts the whole container rather than leaving it half-alive.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> running migrations"
node scripts/migrate.ts
echo "==> seeding demo sources"
node scripts/seed.ts

node apps/api/src/main.ts &
api_pid=$!
node apps/worker/src/main.ts &
worker_pid=$!

forward() {
  echo "==> forwarding signal to api ($api_pid) and worker ($worker_pid)"
  kill -TERM "$api_pid" "$worker_pid" 2>/dev/null || true
}
trap forward TERM INT

set +e
wait -n "$api_pid" "$worker_pid"
exit_code=$?
set -e

forward
wait "$api_pid" 2>/dev/null || true
wait "$worker_pid" 2>/dev/null || true
exit "$exit_code"
