# Architecture

How the code is organized, and the JSON API between the web app and the BFF.

## Structure

```
apps/
  web/                      the customer app (thin)
    index.html              HTML shell: metadata crawlers read first
    src/routes/             TanStack Router file routes (/, /jouer, /admin, /sign-in…)
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
  db/                       Drizzle schema, migrations (drizzle/)
  api/                      openapi.json + generated client, hooks and MSW mocks
  ui/                       UI kit on theme tokens
  theme-default/            the brand: one CSS-variable file
  feature-game/             the game: engine, deck, every player screen
  feature-admin/            the hidden admin at /admin
e2e/                        Playwright tests
scripts/                    setup, dev, session, API generation, boundary check
docker/                     Dockerfile, Keycloak development realm
docs/decisions.md           decisions and their reasons
docs/specs/                 feature specs
```

Each package has a short `AGENTS.md` with its rules.

## API

The JSON API lives under `/api`. Its OpenAPI document is at
`/api/openapi.json`, and `packages/api/openapi.json` is the committed copy.

- The admin's routes (`/api/admin/*`) check the admin's session; anyone else
  gets 404. The others (deck, reports, likes, health, me, the document) are
  public, each saying why.
- Bad input gets 400 with `{ error, issues }`.

To change the API, edit `apps/bff/src/routes/api.ts`, run `yarn api:generate`
and commit both. `yarn verify` fails when the generated client is stale.
