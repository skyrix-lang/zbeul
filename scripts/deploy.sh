#!/bin/sh
# yarn deploy: ships the current commit to the server and restarts the app.
#
#   DEPLOY_SSH=user@host DEPLOY_PORT=22 yarn deploy
#
# On the server, DEPLOY_DIR (default: apps/zbeul, under the user's home) holds
# .env.production, which this never touches, and `src`, the deployed commit.
# The image is built on the server, the migrations run, then the app restarts:
# the order that keeps a failed migration from reaching users.
# See "Deploying" in the README for the one-time setup.
set -eu

: "${DEPLOY_SSH:?Set DEPLOY_SSH to user@host}"
port=${DEPLOY_PORT:-22}
dir=${DEPLOY_DIR:-apps/zbeul}

# Only what is committed is deployed: say so rather than surprise.
if ! git diff --quiet HEAD; then
  echo "There are uncommitted changes: they will NOT be deployed." >&2
fi
commit=$(git rev-parse --short HEAD)
echo "Deploying $commit to $DEPLOY_SSH:$dir"

# DEPLOY_SSH_OPTIONS: extra ssh options, such as -S for a shared connection.
# shellcheck disable=SC2086
remote() { ssh -p "$port" ${DEPLOY_SSH_OPTIONS:-} "$DEPLOY_SSH" "$@"; }

remote "test -f '$dir/.env.production'" || {
  echo "$dir/.env.production is missing on the server: see the README." >&2
  exit 1
}

# The new source arrives next to the old one, then takes its place.
git archive --format=tar HEAD |
  remote "set -e; cd '$dir'; rm -rf src.new; mkdir src.new; tar -x -C src.new; ln -s ../.env.production src.new/.env.production; rm -rf src.old; if [ -d src ]; then mv src src.old; fi; mv src.new src"

remote "cd '$dir/src' && sh scripts/deploy-remote.sh"

echo "Deployed $commit."
