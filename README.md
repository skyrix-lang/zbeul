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
a thin app** and shipped as one Docker image. The starter's bookings demo has
been removed: the card admin is the reference for a full-stack feature.

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

## Quick start

Requires Node 24 (`.nvmrc`), Corepack (`corepack enable`) and Docker.

```bash
yarn install
yarn setup        # .env, Postgres, Keycloak, database and migrations
yarn dev          # http://localhost:3000
```

Sign in as `ada` / `ada` on the local Keycloak. `yarn verify` checks everything in seconds (format, types, lint,
boundaries, API contract, unit tests); `yarn test` runs the end-to-end tests.
Every command: [docs/development.md](docs/development.md#scripts).

## Keeping up to date with the starter

Renovate updates versions, and a workflow brings in the starter's changes as
pull requests (`yarn sync-from-starter` does the same by hand), merged with
this project's own: [docs/starter-sync.md](docs/starter-sync.md).

## Documentation

| Guide                                                       | What's in it                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Architecture](docs/architecture.md)                        | the folders and packages, the JSON API                                    |
| [Development](docs/development.md)                          | running it locally, every command, the tests                              |
| [Configuration](docs/configuration.md)                      | the server's variables, sign-in (OpenID Connect), mail                    |
| [Customizing](docs/customizing.md)                          | brand and dark mode, languages, icons, pages, features                    |
| [Design](docs/design.md)                                    | this site's look: tokens, type, sections, do's and don'ts                 |
| [SEO, analytics and compression](docs/seo-and-analytics.md) | metadata, sitemap, 404s, link previews, Google Analytics, gzip and brotli |
| [Security](docs/security.md)                                | sessions, headers and CSP, CSRF, rate limits, supply chain                |
| [Deployment](docs/deployment.md)                            | the Docker image, deploying, rollback, backups, logs                      |
| [New project](docs/new-project.md)                          | from a clone to a GitHub repository with CI and auto-merge                |
| [Automatic deploys](docs/auto-deploy.md)                    | deploying `main` every night, backup first                                |
| [Starter sync](docs/starter-sync.md)                        | keeping this project up to date with the starter                          |
| [Decisions](docs/decisions.md)                              | what was decided, and why                                                 |

## Working with AI agents

`AGENTS.md` is the guide for every agent, with a short `AGENTS.md` per package.
`CLAUDE.md` adds Claude Code's skills, reviewer subagent and hooks. Strict
types, the generated API client, the boundary check and tests that run in
seconds are the guardrails. `yarn verify` is what an agent runs after each step.
