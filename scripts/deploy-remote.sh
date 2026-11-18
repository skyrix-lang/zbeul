#!/bin/sh
# The server's half of `yarn deploy` (scripts/deploy.sh runs it there, from
# the deployed commit): build the image, apply the migrations, restart.
# The version it replaces is kept as zbeul-app:previous: if the new one isn't
# healthy, it's started again (scripts/rollback-remote.sh).
set -eu

compose_file="docker/compose.production.yaml"
if docker compose version >/dev/null 2>&1; then
  compose() { docker compose -f "$compose_file" "$@"; }
else
  compose() { docker-compose -f "$compose_file" "$@"; }
fi

if docker buildx version >/dev/null 2>&1; then
  export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1
else
  # Docker's old builder doesn't know `RUN --mount`, which only caches Yarn's
  # downloads between builds. This copy of the Dockerfile does without it.
  echo "No BuildKit on this server: building without the download cache." >&2
  echo "Install it for faster builds: sudo apt install docker-buildx" >&2
  sed -i 's/--mount=type=cache,target=[^ ]* //' docker/Dockerfile
fi

# The running version, kept before the build replaces the name. Older
# deploys used compose's default name, zbeul-app:latest.
for running in zbeul-app:current zbeul-app:latest; do
  if docker image inspect "$running" >/dev/null 2>&1; then
    docker tag "$running" zbeul-app:previous
    break
  fi
done

# Both images, by name: `migrate` has a profile, so a plain `build` skips it
# and the next release would run the previous release's migrations.
compose build app migrate
# Before the new version starts: a failed migration stops the deploy here,
# with the old version still running.
compose run --rm migrate
# Waits for the health check. `up` has already stopped the old container by
# then, so a new version that isn't healthy is replaced by the previous one.
if ! compose up -d --wait app; then
  echo "The new version isn't healthy: rolling back." >&2
  sh scripts/rollback-remote.sh || true
  exit 1
fi
# This project's leftovers only: the server runs other things. Untagged
# images only, so zbeul-app:previous stays for a rollback.
docker image prune -f --filter "label=com.docker.compose.project=zbeul" >/dev/null
compose ps
