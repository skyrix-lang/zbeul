# Zbeul

**Zbeul, the game for afterparties**: party games for friends on one phone you
pass around, from a quiet aperitif to very borderline. In French, free, without
an account, and installable on the phone's home screen, where it plays without
a connection. For adults only.

- **The game** (`packages/feature-game`): 15 mini-games mixed in one game,
  five levels, sips or points, teams or every player for themselves. What it
  does is specified in `specs/specs.md`; the 870 cards are in
  `specs/cartes-mvp.md` and bundled with the app (`yarn cards:generate`).
  Everything about the players stays on the phone.
- **The hidden admin** (`packages/feature-admin`, at `/admin`): one account
  with a password, to write, publish and archive cards and packs, see who
  changed what, and read what players report. Players get the published deck
  at the home screen and keep it for offline play; the bundled deck is the
  fallback before that (`docs/specs/admin-cards.md`).

It is built from a full-stack starter, organized as **versioned packages plus
a thin app** and shipped as one Docker image. The starter's bookings feature
is still there, out of sight, as the reference for a full-stack feature.

- **Web:** React 19 single-page app with strict TypeScript and Vite. TanStack
  Router for typed routes and TanStack Query for server data. shadcn/ui-style
  components on Base UI, Tailwind CSS v4, React Hook Form and Zod 4.
- **BFF (backend-for-frontend):** Hono on Node. It signs users in with OpenID
  Connect as a confidential client, keeps sessions in an HttpOnly cookie, serves
  the JSON API from PostgreSQL through Drizzle, sets the security headers and
  serves the built SPA.
- **Contract:** the BFF's routes produce an OpenAPI document. Orval generates
  the typed client, the TanStack Query hooks and the MSW mocks from it.
- **Quality:** oxlint (type-aware) and oxfmt from [oxc.rs](https://oxc.rs),
  Vitest with MSW, Playwright with axe (WCAG 2.2 AA), and dependency rules
  between packages.

## Structure

```
apps/
  web/                      the customer app (thin)
    index.html              HTML shell: metadata crawlers read first
    src/routes/             TanStack Router file routes (/, /bookings, /sign-in)
    src/overrides.ts        typed page overrides for a customer
    src/styles.css          Tailwind + UI kit + the customer's theme
  bff/                      Hono server
    src/app.ts              security headers, CSRF, routes, static SPA
    src/routes/api.ts       JSON API, declared with Zod (OpenAPI)
    src/routes/auth.ts      /auth/login, /auth/callback, /auth/logout
    src/session.ts          server-side sessions (HttpOnly cookie)
    src/env.ts              settings, checked at startup
    src/mail.ts             mail over SMTP (logged when unconfigured)
packages/
  core/                     Zod schemas and types shared by web and BFF
  db/                       Drizzle schema, migrations (drizzle/), seed data
  api/                      openapi.json + generated client, hooks and MSW mocks
  ui/                       UI kit on theme tokens
  theme-default/            the brand: one CSS-variable file
  feature-bookings/         the bookings screens (reference feature)
e2e/                        Playwright tests
scripts/                    setup, dev, session, API generation, boundary check
docker/                     Dockerfile, Keycloak development realm
docs/decisions.md           decisions and their reasons
docs/specs/                 feature specs
```

Each package has a short `AGENTS.md` with its rules.

## Starting a project from this starter

```bash
yarn install
yarn rename acme-portal "Acme Portal"
```

`yarn rename` replaces the starter's name wherever it's an identifier: the
`@zbeul/*` package scope, the root package and image, the local containers,
database, Keycloak realm and client, and the site name. It leaves the bookings
feature alone: keep it to copy from, and remove it when the project has its
own. Review the diff, then continue below. It also writes `.starter.json`:
commit it, it's where `yarn sync-from-starter` starts from.

The whole setup, from the clone to a GitHub repository with auto-merge, CI,
Claude, Renovate and the starter sync, step by step (Claude can run most of
it): [docs/new-project.md](docs/new-project.md). To deploy `main` to a
server every night, with a database backup first: [docs/auto-deploy.md](docs/auto-deploy.md).

## Keeping a project up to date with the starter

- **Versions:** Renovate updates every repository with one policy, the
  starter's `default.json`; each `renovate.json` only extends it. Install the
  Renovate GitHub app on each repository.
- **Everything else** (scripts, CI, Docker, configs, packages): in the project,
  `yarn sync-from-starter --dry-run`, then `yarn sync-from-starter`. It merges
  what changed in the starter since the commit in `.starter.json` with the
  project's own changes, as `git merge` would. Review, `yarn verify`, commit.
- **Automatically:** a workflow does that when the starter's `main` changes,
  every Monday, or on demand from the Actions tab, and opens a pull request,
  with Claude resolving conflicts. Clean syncs and Renovate's non-major
  updates merge themselves once CI passes (`scripts/setup-github.sh`).
  Claude also reviews every pull request, and `@claude` in an issue or pull
  request asks it for any other work. All need a few secrets: see the guide.

The whole process, conflicts and the rules for changing the starter:
[docs/starter-sync.md](docs/starter-sync.md).

## Getting started

Requires Node 24 (`.nvmrc`), Corepack (`corepack enable`) and Docker.

```bash
yarn install
yarn setup        # .env, Postgres, Keycloak, database and migrations
yarn dev          # http://localhost:3000
```

Sign in as `ada` / `ada` or `grace` / `grace` on the local Keycloak. Then run
`yarn db:seed ada@example.test` to give that user demo bookings. Keycloak's
admin console is at http://localhost:8180 (admin / admin).

`yarn dev` runs the BFF (port 3001, restarts on change) and Vite (port 3000).
Vite forwards `/api` and `/auth` to the BFF, so the browser sees a single
origin, as in production.

## Scripts

| Command                                           | What it does                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `yarn dev`                                        | BFF and Vite dev servers                                                  |
| `yarn build` / `yarn start`                       | production build; serve it with the BFF                                   |
| `yarn verify`                                     | format, types, type-aware lint, boundaries, API contract, unit tests      |
| `yarn test`                                       | Playwright against the production build (Postgres and Keycloak in Docker) |
| `yarn test:unit` / `yarn test:watch`              | Vitest                                                                    |
| `yarn api:generate`                               | OpenAPI document from the BFF's routes, then client, hooks and mocks      |
| `yarn setup`                                      | prepare a checkout or worktree                                            |
| `yarn rename <name> ["Display Name"]`             | once, in a new project: replace the starter's name everywhere             |
| `yarn sync-from-starter [--dry-run]`              | in a project: merge in what changed in the starter since the last sync    |
| `yarn dev:session [email] [--seed]`               | sign in locally without Keycloak, print the cookie                        |
| `yarn db:generate --name=<x>` / `yarn db:migrate` | new migration / apply migrations                                          |
| `yarn db:seed <email>`                            | demo bookings for a user who has signed in                                |
| `yarn db:up` / `yarn keycloak:up`                 | start the local containers                                                |
| `yarn docker:build`                               | build the image                                                           |
| `yarn docker:up` / `yarn docker:down`             | the image with Postgres, migrations and Keycloak (Docker Compose)         |
| `yarn deploy`                                     | ship the current commit to a server, backup first ("Deploying")           |

## Configuration

The BFF reads its settings from the environment when it starts
(`apps/bff/src/env.ts`). A missing or invalid value stops it with a list of
every problem. Nothing is baked in at build time, so one image serves any
customer and any domain.

| Variable                                               | Meaning                                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `PUBLIC_URL`                                           | the address people use; used for the OIDC callback, the CSRF check, the canonical URL and the sitemap |
| `DATABASE_URL`                                         | Postgres                                                                                              |
| `SESSION_SECRET`                                       | signs the short-lived sign-in cookie (32+ random characters in production)                            |
| `ADMIN_EMAIL`                                          | the admin's account; unset, there is no admin                                                         |
| `ADMIN_SETUP_CODE`                                     | lets the admin choose their password, the first time only (16+ characters)                            |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`  | an identity provider and its confidential client; optional, all three or none                         |
| `PORT`, `HOST`                                         | where the BFF listens (3000 and 0.0.0.0 in the image)                                                 |
| `LOG_LEVEL`                                            | `debug`, `info` (default), `warn`, `error` or `silent`                                                |
| `STATIC_DIR`                                           | the built SPA (set in the image)                                                                      |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | the SMTP server mail goes through; unset, mail is only logged (see [Mail](#mail))                     |
| `MAIL_FROM`                                            | the sender, on a domain the SMTP server may send for                                                  |

## Authentication

Players never sign in: the game has no accounts.

**The admin** is one account, named by `ADMIN_EMAIL`, that signs in at `/admin`
with a password. There is no email to send and no provider to configure:

1. Set `ADMIN_EMAIL` and a random `ADMIN_SETUP_CODE` (`openssl rand -hex 24`)
   in the server's environment.
2. Open `/admin#code=<the code>`. The first time, the page asks for the
   account's email and a new password: at least 12 characters, with a
   lowercase letter, an uppercase letter, a digit and a symbol.
3. From then on `/admin` is an ordinary sign-in, and the code does nothing. To
   choose another password, clear `password_hash` for that user in the
   database and use the code again.

The password is stored as a scrypt hash (`apps/bff/src/password.ts`), attempts
are limited per client address, and every admin route of the API answers 404
to anyone who isn't the admin, signed in or not. Nothing on the public site
links to `/admin`, it is never indexed, and the service worker never serves it
offline.

**An identity provider is optional**, and production runs without one. The
starter's signed-in pages (the bookings) use it, as do the e2e tests, with the
local Keycloak.

Any OpenID Connect provider works: Keycloak, Entra ID, Auth0, Google and
others. Create a **confidential** client with:

- the authorization code flow and PKCE (S256);
- the redirect URI `${PUBLIC_URL}/auth/callback`;
- the post-logout redirect URI `${PUBLIC_URL}/`;
- the scopes `openid email profile`.

The browser never sees a token or the client secret. After the callback, the
BFF stores a session row and sets an HttpOnly cookie, so deleting the row
signs that session out. Signing out also ends the provider's session. Users
are identified by issuer and subject. A user created ahead of their first
sign-in, by email and with no identity yet (as `yarn dev:session` does), is
linked to it when the provider has verified that email.

Who may sign in is decided by the provider: every account it accepts gets in.
Use the customer's own provider, or restrict a shared one to their users,
groups or domain. Never point `OIDC_ISSUER` at a public provider without such a
restriction.

## Mail

`mailer().send({ to, subject, text, html? })` (`apps/bff/src/mail.ts`) sends
through any SMTP server with Nodemailer, such as Scaleway Transactional Email:

```bash
SMTP_HOST=smtp.tem.scaleway.com
SMTP_PORT=465                       # TLS: 465, 2465. STARTTLS: 587, 2587, 25
SMTP_USER=<project id>
SMTP_PASSWORD=<API secret key>
MAIL_FROM="Acme <no-reply@acme.example>"   # on a domain verified in TEM
```

Credentials never travel unencrypted: ports other than 465 and 2465 must
upgrade with STARTTLS, or the mail isn't sent. A refused mail throws.

**No real mail in tests.** Without `SMTP_HOST`, nothing is sent: the mail is
logged (recipient and subject in development, a bare warning in production).
`vitest.config.ts` and `playwright.config.ts` both empty `SMTP_HOST`, which
wins over `.env` and the shell. In production a sent mail is logged by its
message id only, and a refusal by its SMTP codes, without the server's reply
(it often quotes the recipient). `yarn dev`
does send when `.env` has SMTP settings, so use addresses you own there.

Anything that sends mail because of a request must be rate limited with
`hit()` from `apps/bff/src/rate-limit.ts`.

## API

The JSON API lives under `/api`. Its OpenAPI document is at
`/api/openapi.json`, and `packages/api/openapi.json` is the committed copy.

- Every route except `/api/health`, `/api/me` and the document checks the
  session and returns 401 without one.
- Data is per user. Another user's booking behaves as if it doesn't exist (404).
- Bad input gets 400 with `{ error, issues }`.

To change the API, edit `apps/bff/src/routes/api.ts`, run `yarn api:generate`
and commit both. `yarn verify` fails when the generated client is stale.

## Customizing for a customer

- **Branding:** copy `packages/theme-default` into a new theme package, change
  the CSS variables, and import it in `apps/web/src/styles.css`. Components use
  only these tokens.
- **Pages:** replace a package's page in `apps/web/src/overrides.ts`. A route
  that doesn't exist is a type error. Add the customer's own routes in
  `apps/web/src/routes/`.
- **Features:** add a `packages/feature-*` package. It may depend on `core`,
  `api` and `ui` only (`scripts/check-boundaries.ts`).

## Tests

- **Unit and component tests** (`yarn test:unit`) live next to the code. Pure
  logic runs on Node. Components run in jsdom with Testing Library, and every
  request goes to MSW handlers from `@zbeul/api/mocks`; an unhandled request
  fails the test.
- **End-to-end tests** (`yarn test`) build the app and run it with the bundled
  BFF on its own port and database, signing in through the local Keycloak.
  Every test also fails on a browser console error, or on an axe accessibility
  violation (WCAG 2.2 AA) on the page it ends on. Most tests sign in by writing
  a session row; `e2e/auth.spec.ts` drives the real Keycloak login.

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

### Deploying

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

### Deploying automatically

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

### Backups

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

### Logs

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

## SEO

The app renders in the browser. Every URL first returns `apps/web/index.html`,
and the BFF fills in `PUBLIC_URL` when it serves it. That file carries the home
page's title, description, canonical URL, Open Graph tags and JSON-LD.
`robots.txt` and `sitemap.xml` are built from `PUBLIC_URL`. The pages listed in
`PUBLIC_PATHS` (`packages/core/src/site.ts`) appear in the sitemap. App pages
add `noindex` when they render. A public page that has to rank on its own
content needs prerendering (see `docs/decisions.md`).

## Security

- Sign-in uses OIDC with PKCE through a confidential client. Sessions are
  server-side, the cookie is HttpOnly and SameSite=Lax (`__Host-` on https),
  and only a hash of the session token is stored.
- The CSP allows scripts from `'self'` only, with no `'unsafe-inline'`. The
  other headers are HSTS, `X-Frame-Options: DENY`, `nosniff` and a strict
  referrer policy (`apps/bff/src/app.ts`). Add third-party origins there.
- The CSRF check refuses cross-site form posts. There is no CORS, so other
  origins can't send JSON.
- Sign-ins are rate limited per client address (`apps/bff/src/rate-limit.ts`).
- Supply chain: install scripts are disabled, versions younger than 7 days are
  refused, CI installs from the lockfile only, and Renovate waits 7 days too.

## Working with AI agents

`AGENTS.md` is the guide for every agent, with a short `AGENTS.md` per package.
`CLAUDE.md` adds Claude Code's skills, reviewer subagent and hooks. Strict
types, the generated API client, the boundary check and tests that run in
seconds are the guardrails. `yarn verify` is what an agent runs after each step.
