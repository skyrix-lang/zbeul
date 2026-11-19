# Deployment

The Docker image, deploying it to a server, backups and logs.

## Docker

```bash
yarn docker:build
# Apply migrations (a deploy step, never at startup), then start the app
docker build --target migrate -t zbeul-migrate -f docker/Dockerfile .
docker run --rm -e DATABASE_URL=... zbeul-migrate
docker run -p 3000:3000 -e PUBLIC_URL=https://zbeul.example.com \
  -e DATABASE_URL=... -e SESSION_SECRET=... \
  -e ADMIN_EMAIL=... -e ADMIN_SETUP_CODE=... \
  zbeul:1.0.0
```

The runtime image holds Node, a single bundled `server.js` and the static
files: no `node_modules`, no package manager, and it runs as a non-root user.
Its base image is pinned by digest, and Renovate updates it. The image has a
`HEALTHCHECK` on `GET /api/health` (503 when the database is unreachable), and
on `SIGTERM` the server finishes the requests in progress before it exits.

To try the image with everything around it, `yarn docker:up` runs
`docker/compose.yaml`: Postgres, the migrations, a development Keycloak and
the app at http://localhost:8080 (ada / ada). It's for local use only, and
needs a browser that treats `keycloak.localhost` as this machine (Chrome and
Firefox do; Safari needs a line in `/etc/hosts`).

## Deploying

`docker/compose.production.yaml` runs the image behind an
[nginx-proxy](https://github.com/nginx-proxy/nginx-proxy) with its Let's
Encrypt companion, which route by `VIRTUAL_HOST` and renew the certificate
themselves. The app must be served over https: a service worker, and so the
install and the offline play, need it.

One-time setup on the server, in the directory `yarn deploy` uses
(`apps/zbeul` in the user's home by default; `DEPLOY_DIR` changes it):

1. Create a database and its user in Postgres.
2. Write `.env.production` there, readable by its owner only:

   ```bash
   VIRTUAL_HOST=zbeul.example.com
   VIRTUAL_PORT=3000
   LETSENCRYPT_HOST=zbeul.example.com
   LETSENCRYPT_EMAIL=you@example.com
   PUBLIC_URL=https://zbeul.example.com
   DATABASE_URL=postgres://zbeul_user:<password>@postgres:5432/zbeul_db
   SESSION_SECRET=<openssl rand -base64 33>
   ADMIN_EMAIL=you@example.com
   ADMIN_SETUP_CODE=<openssl rand -hex 24>
   ```

Then, for each release, from a checkout of the commit to ship:

```bash
DEPLOY_SSH=user@host DEPLOY_PORT=22 yarn deploy
```

It copies the commit to the server (no git access is needed there), then
`scripts/deploy-remote.sh`, on the server:

1. builds the new image while the old version still serves players, keeping
   the running one as `zbeul-app:previous`;
2. stops the app, so nothing is written from the backup on (players see the
   proxy's error page for about a minute);
3. backs the database up and proves the backup (see "Backups"). If the backup
   fails, the old version starts again and nothing is migrated;
4. applies the migrations, then starts the new version and waits for its
   health check.

Then `yarn deploy` checks the public address (the server's `PUBLIC_URL`, or
`DEPLOY_URL` if set): `/api/health` and `/` must answer over https within
about a minute.

**Rollback.** When step 4 fails, or the public address doesn't answer,
`scripts/rollback-remote.sh` puts back both halves and the deploy fails,
saying so:

- **the database**, from the backup of step 3, if a migration ran since (it
  compares how many migrations the database has applied with the count
  before the deploy). If none ran, the data stays as it is. The app was
  stopped since the backup, so the restore loses nothing players wrote;
- **the app**: `zbeul-app:previous` starts again.

To roll back by hand, right after a failed deploy:
`ssh <user>@<server> 'cd apps/zbeul/src && sh scripts/rollback-remote.sh'`.
Once a deploy has succeeded, rolling back only swaps the image back and
leaves the data alone. To restore the data anyway, see "Backups".

A server whose Docker has no BuildKit
still builds, more slowly: `sudo apt install docker-buildx` fixes that. The
proxy sets `x-forwarded-for`, which the rate limits read. The app sets its own
cache headers: the proxy needs no rule for the service worker.

## Deploying automatically

`.github/workflows/deploy.yml` runs every night at 02:00, Paris time, when
nobody plays:

- `main` has a commit the server doesn't run yet, and CI passed on it:
  `yarn deploy` ships it (backup first, see "Deploying");
- otherwise the database is backed up anyway: one backup a night, at least.

When something fails (the backup, a migration, the health check, the public
address), the previous version and its data stay or are put back (see
"Rollback" above) and the run fails, so you get GitHub's failure
notification. **Run workflow** in the Actions tab deploys `main` now, whatever
the hour. It does nothing until `DEPLOY_SSH` is set, and deploys need
"Backups" set up first.

One-time setup:

1. **A key for GitHub only**, on your machine. No passphrase, since nobody
   types it; it never leaves this machine except into the secret below:

   ```bash
   ssh-keygen -t ed25519 -N "" -C "zbeul deploy from GitHub" -f ~/.ssh/zbeul_deploy
   ```

   Add `~/.ssh/zbeul_deploy.pub` to `~/.ssh/authorized_keys` of the server
   user that runs `yarn deploy` today (it needs Docker access and the deploy
   directory, nothing more). `ssh-copy-id -i ~/.ssh/zbeul_deploy.pub -p 22 user@host`
   does it.

2. **The environment:** Settings → Environments → **New environment**,
   `production`. Under "Deployment branches and tags", choose "Selected
   branches" and add `main`. Tick "Required reviewers" only if you want to
   approve each deploy.
3. **Its secrets and variables**, from a terminal (each `secret set` reads the
   value from the file or command, so it never shows on screen):

   ```bash
   gh secret set DEPLOY_SSH_KEY --env production -R skyrix-lang/zbeul < ~/.ssh/zbeul_deploy
   ```

   ```bash
   ssh-keyscan -p 22 host | gh secret set DEPLOY_KNOWN_HOSTS --env production -R skyrix-lang/zbeul
   ```

   ```bash
   gh variable set DEPLOY_SSH -R skyrix-lang/zbeul --body "user@host"
   ```

   The secrets belong to the environment, so only a job deploying `main` can
   read them; `DEPLOY_SSH` is a repository variable, since the workflow reads it
   to decide whether to run at all. Compare the host key `ssh-keyscan` printed with the one your own
   `~/.ssh/known_hosts` has for the server (`ssh-keygen -F host`): the secret
   pins it, so the workflow refuses a server that answers with another key.
   Set `DEPLOY_PORT` (default 22) and `DEPLOY_DIR` (default `apps/zbeul`) the
   same way if yours differ.

4. **Try it:** Actions → Deploy → **Run workflow**.

To stop automatic deploys, delete the `DEPLOY_SSH` variable. If the key is
ever exposed, remove its line from the server's `authorized_keys`.

## Backups

`scripts/backup-remote.sh` dumps the database (`pg_dump`, custom format, with
the server's own Postgres version), restores the dump into a throwaway
Postgres and compares its tables (and, before a deploy, every table's row
count) with the database, uploads it to a Cloudflare R2 bucket and checks R2
holds all of it. Only then does a deploy go on. The last 7 backups also stay
on the server, in `apps/zbeul/backups`. It runs every night (see "Deploying
automatically") and before every deploy.

One-time setup:

1. **The bucket**, in the Cloudflare dashboard: R2 → **Create bucket**,
   named `zbeul-backups` for example, location automatic. In its Settings →
   **Object lifecycle rules**, add a rule that deletes objects after 30 days
   (or how long you want to keep them). Optionally, **Bucket lock rules**
   keep each backup from being deleted or replaced for a few days, even with
   the key.
2. **A key for it:** R2 → **Manage API tokens** → **Create API token**,
   permission **Object Read & Write**, applied to that bucket only. Keep the
   Access Key ID, the Secret Access Key, and your account ID (in the S3
   endpoint, `https://<account id>.r2.cloudflarestorage.com`).
3. **On the server**, next to `.env.production`, `backup.env` readable by its
   owner only, from the template `docker/backup.env.example`:

   ```bash
   install -m 600 /dev/null apps/zbeul/backup.env && nano apps/zbeul/backup.env
   ```

   ```bash
   R2_ACCOUNT_ID=<account id>
   R2_BUCKET=zbeul-backups
   AWS_ACCESS_KEY_ID=<access key id>
   AWS_SECRET_ACCESS_KEY=<secret access key>
   ```

4. **Try it**, after the next deploy has copied the scripts there:
   `ssh <user>@<server> 'cd apps/zbeul/src && sh scripts/backup-remote.sh'`.
   The backup appears in the bucket under `zbeul/`.

The database user must own its database: a restore drops and creates the
`public` schema.

**Restoring by hand.** On the server, with the latest backup or the one you
name (download an older one from R2 into `apps/zbeul/backups` first):

```bash
cd apps/zbeul/src && sh scripts/restore-remote.sh ../backups/zbeul-<date>.dump
```

It stops the app and restores in one transaction, so a failed restore leaves
the database as it was. Then start the version that matches the data:
`docker compose -f docker/compose.production.yaml up -d --no-build app` (or
`sh scripts/rollback-remote.sh` for the previous one).

## Logs

The BFF writes one line per event to stdout, and warnings and errors to
stderr: JSON in the image, readable text in development. Each request is one
line with its method, path (never the query string), status and duration,
except health checks that succeed. Its id is returned as `x-request-id` and
added to everything logged while handling it; a proxy that sends
`x-request-id` keeps its own id. Errors are logged with their message, code
and stack only: query parameters and whatever a library attached to them are
dropped. Log with `log` from `apps/bff/src/log.ts`; lint refuses `console`.

CI builds the image on `main` and on tags, with an SBOM and build provenance,
and signs release tags with cosign. See `SECURITY.md`.
