#!/bin/sh
# Starts the version the last deploy replaced again, on the server:
# zbeul-app:previous becomes zbeul-app:current, without building anything.
# scripts/deploy-remote.sh runs it when the new version isn't healthy, and
# scripts/deploy.sh when the public address doesn't answer after a deploy.
#
# It doesn't undo migrations: the previous version runs on the database as
# the new one left it. That's why a migration only adds (a column, a table)
# in one release, and removes what the old code still reads in a later one.
set -eu

compose_file="docker/compose.production.yaml"
if docker compose version >/dev/null 2>&1; then
  compose() { docker compose -f "$compose_file" "$@"; }
else
  compose() { docker-compose -f "$compose_file" "$@"; }
fi

if ! docker image inspect zbeul-app:previous >/dev/null 2>&1; then
  echo "No previous version on this server (zbeul-app:previous): nothing to roll back to." >&2
  exit 1
fi

docker tag zbeul-app:previous zbeul-app:current
compose up -d --no-build --force-recreate --wait app
echo "Rolled back: the previous version is running again."
compose ps
