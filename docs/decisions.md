# Decisions

Choices made on purpose, with the reason and when to reconsider them. Don't reverse
one as a side effect of other work: propose it, and record the outcome here. New
decisions go at the end.

## Client-only SPA and a BFF

React 19 + Vite builds static files; a small Hono server (the BFF) serves them,
handles sign-in and sessions, and owns the JSON API and the database. No server
rendering.
**Why:** request-time server rendering has had critical vulnerabilities in
2025-2026 (remote code execution, middleware bypass, cache poisoning) that
can't apply to static files; one image per customer is simple to configure at
start; and React with typed routes is what coding agents handle best.
**Cost:** public pages are client-rendered. Crawlers get `index.html`'s metadata
first; a page that must rank on its own content needs prerendering.
**Revisit when:** public content must rank beyond the home page: prerender those
routes (React Router 8 with `ssr: false` prerendering, or a static generator)
rather than adding a request-time server renderer.

## Versioned packages plus a thin app per customer

`packages/*` hold the core, the generated API client, the UI kit, features and
a theme; `apps/web` composes them, adds routes and declares typed page
overrides (`apps/web/src/overrides.ts`) at build time. Packages export their
TypeScript source and are consumed through Yarn workspaces for now.
`scripts/check-boundaries.ts` enforces which package may import which, and that
each declares what it imports.
**Why:** one core serves many customer projects, and each upgrades by bumping
package versions instead of merging changes into a copy: semver sits on the
customization surface.
**Revisit when:** a customer project lives in its own repository: publish the
packages to a private registry with a build step and changesets. Skip
micro-frontends unless customers must ship pages without a rebuild.

## OIDC confidential client in the BFF

The BFF signs users in with OpenID Connect (authorization code + PKCE, state and
nonce) as a confidential client, using `openid-client`. Users are identified by
issuer and subject; sessions are rows in `user_sessions` holding a hash of the
cookie's token, so deleting a row signs out at once. The browser only holds an
HttpOnly, SameSite=Lax cookie (`__Host-` on https). Signing out also ends the
provider's session. Local development and tests use Keycloak in Docker
(`docker/keycloak/realm.json`); production uses the customer's provider.
A user created ahead of their first sign-in (by email, with no identity yet)
is linked when the provider has verified that email, not duplicated.
**Why:** the IETF guidance for browser apps (RFC 10017) recommends against
tokens in the browser for apps handling personal data, and a client secret
must never be in the bundle.
**Open:** sessions last 30 days and aren't rechecked with the provider, so a
user disabled there stays signed in until expiry. Add a shorter or sliding
expiry, a refresh-token check, or back-channel logout when a customer needs it.

## Data belongs to a user

Every row of per-user data has a `user_id`. Every BFF data function takes the
signed-in user's id and filters by it, and another user's row behaves as if it
doesn't exist (404). The owner column isn't returned.
**Why:** the check lives in one place per query, not in each caller, and a missing
filter shows up in review as an unused argument.
**Revisit when:** something needs sharing or roles: add them explicitly, don't
loosen the filter.

## TanStack Query through a generated client

The BFF's routes are declared with `@hono/zod-openapi`, which produces
`/api/openapi.json`. Orval generates the typed client, TanStack Query hooks and
MSW mocks into `packages/api` (`yarn api:generate`); `yarn api:check` in
`yarn verify` fails when either is stale. Zustand is the client-state library,
added with the first feature that needs client-only state.
**Why:** a wrong field or route is a compile error instead of a runtime one, and
agents never hand-write API types.

## Postgres with Drizzle, migrations as committed SQL

`yarn db:generate` writes SQL from `packages/db/src/schema.ts` into
`packages/db/drizzle/`. It's reviewed and committed, never edited once applied,
and run as a deploy step (the image's `migrate` stage), not at startup.
**Why:** the SQL that runs in production is the SQL that was reviewed, and a
failed migration stops a deploy rather than a running app.

## Rate limits in Postgres

Fixed-window counters in the `rate_limits` table (`apps/bff/src/rate-limit.ts`).
**Why:** no extra service such as Redis, and every instance shares the counts.
**Revisit when:** something rate-limited is hot enough that a row write per hit
matters. The client address comes from `x-forwarded-for`, so deploy behind a
proxy that sets it.

## Environment checked at startup

`apps/bff/src/env.ts` validates with Zod. `apps/bff/src/server.ts` runs it when
the server starts, and exits on failure. Nothing is read at build time, so one
image serves any customer and domain.
**Why:** a bad deploy fails where it's deployed, not on the first request.

## Strict CSP set by the BFF

`script-src 'self'` with no `'unsafe-inline'`: Vite emits no inline scripts.
`form-action` allows the identity provider, for sign-out. Set in
`apps/bff/src/app.ts` with Hono's `secureHeaders`.
**Why:** the strongest policy that costs nothing when nothing is
server-rendered.
**Revisit when:** a provider's `end_session_endpoint` isn't on the issuer's
host: add its origin to `form-action`.

## Vitest, MSW and Playwright with axe

Vitest runs unit tests (node) and component tests (jsdom, Testing Library,
MSW handlers from the generated mocks; unhandled requests fail). Playwright runs
against the production bundle with real Postgres and Keycloak, and every test
also fails on a console error or an axe WCAG 2.2 AA violation.
**Why:** fast feedback that makes agent-written code trustworthy, and the
European Accessibility Act covers e-commerce and e-ticketing.

## oxlint and oxfmt, not ESLint and Prettier

Lint is type-aware (`oxlint --type-aware`, with `oxlint-tsgolint`).
**Why:** much faster, one toolchain (oxc.rs), enough rules for this project.

## Yarn supply-chain settings

`.yarnrc.yml` disables install scripts and refuses versions published less than
7 days ago; CI installs with `--immutable`; Renovate waits 7 days too. Release
images carry an SBOM and provenance and are signed with cosign; `SECURITY.md`
is the disclosure policy.
**Why:** npm worms kept arriving through 2026, and the Cyber Resilience Act
expects SBOMs and vulnerability handling for delivered software.
**Revisit when:** a dependency truly needs its install script: allow that one
package in `dependenciesMeta`, never globally.

## Each checkout is isolated

The main checkout uses ports 3000 (Vite) and 3001 (BFF) and the `zbeul`
database. A git worktree gets its own dev ports, dev database and e2e port and
database (`scripts/checkout.ts`, `yarn setup`). Postgres and Keycloak are shared.
**Why:** several agents can work in parallel worktrees without one's migrations or
test reset breaking another's.

## Node 24, pinned in three places

`.nvmrc` (local and CI), the base image in `docker/Dockerfile` (by digest) and
the BFF's build target in `apps/bff/vite.config.ts` name the same major version.
**Why:** an even-numbered release in long-term support, with security fixes
until April 2028, and it still ships Corepack, which provides Yarn.
**Revisit when:** moving to Node 26 or later: Corepack is no longer bundled, so
the image and CI must install it (or Yarn) themselves. Change all three together.

## Structured logs on stdout, without a library

`apps/bff/src/log.ts` writes one JSON line per event in production and text in
development, with a request id carried by `AsyncLocalStorage` and returned as
`x-request-id`. Requests are logged with their path only, and errors with their
message, code and stack only.
**Why:** a container's platform collects stdout and can filter JSON by level or
request id; a query string can carry a sign-in code, and libraries attach
query parameters and token responses to their errors; and one small file needs
no dependency.
**Revisit when:** traces or metrics are needed, or a second service must share
a request's id: add OpenTelemetry then, and keep `log` as the one entry point.

## Compose file for trying the image, not for production

`docker/compose.yaml` runs the image with Postgres, the migration stage and a
development Keycloak, in deploy order. Keycloak is reached as
`keycloak.localhost` on the same port by the browser and by the app, because
the issuer must be one address for both.
**Why:** the image is what ships, so there must be a one-command way to run it
as it runs in production. Its secrets are public: it is not a deployment.

## The game runs on the phone, and only there

The game is plain functions on plain data (`packages/feature-game/src/engine`),
the deck is bundled with the app, and everything a game needs or remembers is
in `localStorage`, through Zustand's `persist`. The server is not involved in a
game at all.
**Why:** the spec's first promises are "nothing about the players is sent
online" and "playable without a connection". A deck fetched from the API would
break the second, and any server state the first. Zustand because it was
already the recorded choice for client state, has no dependency, and its
`persist` middleware has the `version` and `migrate` options that "a game
saved by an older version stays playable" needs.
**Since then:** the admin edits cards, so the database is the deck's source of
truth. The game still runs on the phone only: the home screen fetches the
published deck (`GET /api/deck`), checks it and keeps it in `localStorage`,
and the bundled deck is the fallback before the first one arrives. A deck is
never swapped in during a game (`docs/specs/admin-cards.md`).
**Since then (2):** a thumb up on a card sends an anonymous like
(`POST /api/likes`), so the admin learns which cards work. It is a count per
card and nothing else; like a report, it carries nothing about the players or
the game, and waits on the phone until the game is paused or over. The privacy
page says so (`docs/specs/play-feedback.md`).
**Cost:** the bundled deck and `specs/cartes-mvp.md` drift from the database
as the admin works; they are only what a first visit without a connection
plays.

## Game pages are public, without an account

The game's routes don't call `requireUser`. All but the home are `noindex`,
and all sit behind the age gate (`apps/web/src/routes/_game.tsx`); the legal
pages are outside it.
**Why:** the game has no accounts by design. The starter's rule (app pages
require a user) still holds for pages that read server data.

## Offline with a generated service worker (vite-plugin-pwa, Workbox)

The build precaches every file of the app; `registerType: "prompt"` makes a
new version wait until the home screen applies it (`apps/web/src/pwa.ts`).
`/api`, `/auth` and `/admin` never come from the cache. The BFF serves
`sw.js` and the manifest with `no-cache`.
**Why:** precache revisions, atomic updates and cache cleanup are where a
hand-written service worker goes wrong, and Workbox is what almost every Vite
app uses for it. It is a build-time dependency only.
**Cost:** `workbox-build` brings many transitive packages into the lockfile.
**Revisit when:** the admin serves the deck: add a runtime cache for it.

## One display font, self-hosted

Bricolage Grotesque (variable, OFL), from `@fontsource-variable`, imported by
the theme. Card text uses it; the interface uses the system font.
**Why:** the strict CSP and offline play rule out a font CDN. Among the
candidates rendered on a real card it kept the most character while staying
compact, and its width axis lets a long card narrow its letters before it
shrinks them.

## The admin signs in with a password; an identity provider is optional

One admin, named by `ADMIN_EMAIL`, with a scrypt-hashed password chosen at the
first visit, which `ADMIN_SETUP_CODE` protects (`apps/bff/src/admin.ts`). The
`OIDC_*` settings became optional, and production runs without them. This
narrows "OIDC confidential client in the BFF" above: that flow is unchanged,
but no longer the only way to a session.
**Why:** asked for the first version: one person administers the site, and
neither a mail server (magic links) nor a provider (Google) should be needed
to deploy it. The setup code closes the window in which anyone finding
`/admin` first could have claimed the account.
**Open:** no password reset from the web (clear `password_hash` in the
database), and no second factor.
**Revisit when:** there is a second admin, or email is available: move to the
spec's magic link or Google sign-in, restricted to an allowlist.

## Deployed behind nginx-proxy, built on the server

`yarn deploy` copies the commit over SSH, builds the image there, migrates and
restarts (`scripts/deploy.sh`, `docker/compose.production.yaml`).
**Why:** it fits a personal VPS that already routes its containers with
nginx-proxy and Let's Encrypt, and needs neither a registry nor git access on
the server.
**Revisit when:** builds get slow or there is more than one server: build in
CI and pull the signed image instead.

## The game screen names players to tap, in points mode only

The first version had no player picker on the game screen: "Gagné", "Perdu",
"Joker" and "Carte suivante" at most, and cards for the whole group left the
score alone. The first players asked for the opposite on both sides
(`docs/specs/play-feedback.md`): with sips, only "Carte suivante", and no
score at all; with points, the names of the players to tap on every card the
group judges.
**Why:** with sips the buttons implied a score nobody read; with points a
ranking that ignored half of the cards meant nothing.
**Cost:** one more row on a landscape phone in points mode. Tapping nobody is
always allowed, so the game never waits for a score.

## Stepping back keeps the game before each tap

The store keeps what the game was before each of the last 20 taps (scores,
rules, the last turn: not the whole game) and restores it on "back";
the cards stepped back from are shown again in order instead of being redrawn
(`packages/feature-game/src/store.ts`).
**Why:** undoing by reversing each rule (scores, active rules, partners,
placed cards) would be a second engine to keep right. A snapshot can't be
wrong.
**Cost:** a few kilobytes more in `localStorage`.

## Players' thumbs change which cards come up first

Each card's thumbs up (likes) and down (every report on it) give it a weight,
sent with the deck: the last step of a draw, between the cards of the chosen
mini-game and level, picks by that weight (`packages/core/src/vote-weight.ts`).
A card counts as if it had one vote in the middle already; it ranges from
×0.25 (voted down by all) to ×2 (voted up by all). One thumb down gives ×0.5,
three give ×0.35. Mini-games and levels keep their balance, and no card is
ever left out: only the admin removes one. As a card is played once per game,
a short game mostly holds liked cards, and disliked ones come late, once the
others are used. The deck picks up votes when its cache expires (a minute):
a vote never forces every phone to download it again.
**Why:** few players vote, so two or three thumbs down must be enough to tell
a bad card (the owner's choice, 2026-11-16). Bounded, so one person can only
move a card so far.
**Cost:** reports filed "sans suite" or about a card since fixed still count.
With more players, raise `NEUTRAL_VOTES` (3 to 5) so a card needs more votes
to move.

## Main deploys itself

Once CI passes on `main`, `.github/workflows/deploy.yml` runs `yarn deploy`
from GitHub with a key used for nothing else, against a pinned host key; the
secrets live in a `production` environment limited to `main`. Since auto-merge,
anything merged into `main` (Renovate's updates and the starter's clean syncs
included) reaches players minutes later.
**Why:** one person maintains it; `main` is already guarded by required CI,
and the deploy itself stops with the old version running when a migration or
the health check fails. Building on the server keeps the existing script and
needs no registry access there.
**Revisit when:** a bad release reaches players despite CI: add a staging
server, or require an approval on the `production` environment.

## Projects follow the starter

Projects are copies of the starter (`yarn rename`), not forks or packages.
Renovate updates versions in every repository with one shared policy
(`default.json`, a preset each `renovate.json` extends), and
`yarn sync-from-starter` merges the starter's other changes into a project,
file by file, with `yarn rename`'s rules applied. See `docs/starter-sync.md`.
**Why:** a shared tooling package can't carry CI, Docker or app code, and
needs a registry and releases for every change; merging the starter as a git
remote conflicts on every renamed line. Renovate replaced Dependabot because
Dependabot can't share a config between repositories.
Pull requests merge themselves once CI passes (GitHub auto-merge, CI required
on `main`, merge commits only: `scripts/setup-github.sh`): Renovate's
non-major updates, and a sync that applied cleanly, which the starter
triggers as soon as its `main` changes. A sync with conflicts, even ones
Claude resolved, and Renovate majors wait for a person.
**Why (auto-merge):** one person maintains the starter and its projects; a
clean, green sync is the starter's reviewed change arriving unchanged, while a
resolved conflict is a judgement call CI can't check.
**Revisit when:** there are more than about five active projects, or parts of
the starter (`ui`, `core`) stop changing per project: publish those as
packages.

## Mail over SMTP, logged when unconfigured

The BFF sends mail with Nodemailer through any SMTP server (Scaleway
Transactional Email for now), configured by `SMTP_*` and `MAIL_FROM` at
start. Without `SMTP_HOST` mail is logged and dropped; Vitest and the e2e
run empty it, so tests can't reach a real inbox.
**Why:** SMTP keeps the provider swappable without code changes, and one
switch (is a server set?) is simpler to trust than a per-environment rule.
**Revisit when:** a test must read a mail's content (a sign-in or invitation
link): add a local catcher such as Mailpit to the dev containers and point
the e2e run's `SMTP_HOST` at it, or when a provider's HTTP API is needed
(templates, bounces, webhooks).
