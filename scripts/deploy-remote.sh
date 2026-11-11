#!/bin/sh
# The server's half of `yarn deploy` (scripts/deploy.sh runs it there, from
# the deployed commit): build the image, apply the migrations, restart.
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

compose build
# Before the new version starts: a failed migration stops the deploy here,
# with the old version still running.
compose run --rm migrate
compose up -d app
docker image prune -f >/dev/null
compose ps
