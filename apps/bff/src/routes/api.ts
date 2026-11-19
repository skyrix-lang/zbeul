import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";
import {
  adminCardSchema,
  adminLoginSchema,
  adminSetupSchema,
  bulkCardsSchema,
  cardChangeSchema,
  cardInputSchema,
  deckSchema,
  packInputSchema,
  packSchema,
  createReportSchema,
  likeCardsSchema,
  reportSchema,
  reportStatusSchema,
  updateReportSchema,
} from "@zbeul/core";
import {
  adminSetupNeeded,
  isAdmin,
  listReports,
  logInAdmin,
  setReportStatus,
  setUpAdmin,
} from "../admin";
import {
  createCard,
  createPack,
  listCards,
  listChanges,
  listPacks,
  publishedDeck,
  updateCard,
  updateCards,
  updatePack,
} from "../cards";
import { clientIp } from "../client-ip";
import { isDatabaseReachable } from "../health";
import { hit } from "../rate-limit";
import { createReport, likeCards } from "../reports";
import {
  createSession,
  getSessionUser,
  setSessionCookie,
  type SessionUser,
} from "../session";

// The JSON API. Every route is declared with its schemas, which validate the
// request and make up the OpenAPI document (/api/openapi.json) that
// packages/api generates the web client from. Data is per user: every call
// passes user.id to the data layer, which filters by it.

export type ApiEnv = { Variables: { user: SessionUser } };

const errorSchema = z
  .object({ error: z.string(), issues: z.array(z.unknown()).optional() })
  .meta({ id: "ApiErrorBody" });

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorSchema } },
});

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

const meSchema = z
  .object({
    user: z
      .object({
        email: z.string().nullable(),
        name: z.string().nullable(),
        /** Whether this is the admin: the admin pages show for nobody else. */
        isAdmin: z.boolean(),
      })
      .nullable(),
  })
  .meta({ id: "Me" });

const meRoute = createRoute({
  method: "get",
  path: "/me",
  operationId: "getMe",
  responses: {
    // 200 with null rather than 401: the header asks on every page, and a 401
    // would be logged as an error by the browser.
    200: json(meSchema, "The signed-in user, or null"),
  },
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  operationId: "getHealth",
  responses: {
    200: json(z.object({ status: z.literal("ok") }), "The database answers"),
    503: json(z.object({ status: z.literal("unavailable") }), "It doesn't"),
  },
});

const createReportRoute = createRoute({
  method: "post",
  path: "/reports",
  operationId: "createReport",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createReportSchema } },
    },
  },
  responses: {
    204: { description: "The report is recorded" },
    400: errorResponse("Invalid request"),
    429: errorResponse("Too many reports from this address"),
  },
});

const likeCardsRoute = createRoute({
  method: "post",
  path: "/likes",
  operationId: "likeCards",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: likeCardsSchema } },
    },
  },
  responses: {
    204: { description: "The likes are counted" },
    400: errorResponse("Invalid request"),
    429: errorResponse("Too many likes from this address"),
  },
});

const body = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

const adminStatusRoute = createRoute({
  method: "get",
  path: "/admin/status",
  operationId: "getAdminStatus",
  responses: {
    200: json(
      z.object({ setupNeeded: z.boolean() }).meta({ id: "AdminStatus" }),
      "Whether the admin still has to choose a password",
    ),
  },
});

const adminSetupRoute = createRoute({
  method: "post",
  path: "/admin/setup",
  operationId: "setUpAdmin",
  request: { body: body(adminSetupSchema) },
  responses: {
    204: { description: "The password is set, and the admin is signed in" },
    400: errorResponse("Invalid request, such as a weak password"),
    403: errorResponse("Wrong email or code, or the password is already set"),
    429: errorResponse("Too many attempts from this address"),
  },
});

const adminLoginRoute = createRoute({
  method: "post",
  path: "/admin/login",
  operationId: "logInAdmin",
  request: { body: body(adminLoginSchema) },
  responses: {
    204: { description: "Signed in" },
    400: errorResponse("Invalid request"),
    // Not 401: to the web app a 401 means "your session ended", and it would
    // send the admin away from the form they are filling in.
    403: errorResponse("Wrong email or password"),
    429: errorResponse("Too many attempts from this address"),
  },
});

// To anyone but the admin, the admin's routes don't exist.
const notFound = errorResponse("Not found");

const listReportsRoute = createRoute({
  method: "get",
  path: "/admin/reports",
  operationId: "listReports",
  request: { query: z.object({ status: reportStatusSchema.default("open") }) },
  responses: {
    200: json(z.array(reportSchema), "The reports, newest first"),
    400: errorResponse("Invalid request"),
    404: notFound,
  },
});

const updateReportRoute = createRoute({
  method: "patch",
  path: "/admin/reports/{id}",
  operationId: "updateReport",
  request: {
    params: z.object({ id: z.string() }),
    body: body(updateReportSchema),
  },
  responses: {
    200: json(reportSchema, "The updated report"),
    400: errorResponse("Invalid request"),
    404: notFound,
  },
});

const deckRoute = createRoute({
  method: "get",
  path: "/deck",
  operationId: "getDeck",
  responses: {
    200: json(deckSchema, "The published cards of the published packs"),
    304: { description: "The deck the client already has is current" },
  },
});

const listCardsRoute = createRoute({
  method: "get",
  path: "/admin/cards",
  operationId: "listCards",
  responses: {
    200: json(z.array(adminCardSchema), "Every card, whatever its status"),
    404: notFound,
  },
});

const createCardRoute = createRoute({
  method: "post",
  path: "/admin/cards",
  operationId: "createCard",
  request: { body: body(cardInputSchema) },
  responses: {
    201: json(adminCardSchema, "The new card, with its reference"),
    400: errorResponse("Invalid card, or unknown pack"),
    404: notFound,
  },
});

const updateCardRoute = createRoute({
  method: "patch",
  path: "/admin/cards/{id}",
  operationId: "updateCard",
  request: {
    params: z.object({ id: z.string() }),
    body: body(cardInputSchema),
  },
  responses: {
    200: json(adminCardSchema, "The card, changed"),
    400: errorResponse("Invalid card, unknown pack, or another mini-game"),
    404: notFound,
  },
});

const bulkCardsRoute = createRoute({
  method: "post",
  path: "/admin/cards/bulk",
  operationId: "updateCards",
  request: { body: body(bulkCardsSchema) },
  responses: {
    200: json(
      z.object({ changed: z.int() }).meta({ id: "BulkCardsResult" }),
      "How many cards changed",
    ),
    400: errorResponse("Invalid request, or unknown pack"),
    404: notFound,
  },
});

const listChangesRoute = createRoute({
  method: "get",
  path: "/admin/changes",
  operationId: "listCardChanges",
  request: { query: z.object({ cardId: z.string().max(30).optional() }) },
  responses: {
    200: json(z.array(cardChangeSchema), "The latest changes, newest first"),
    400: errorResponse("Invalid request"),
    404: notFound,
  },
});

const listPacksRoute = createRoute({
  method: "get",
  path: "/admin/packs",
  operationId: "listPacks",
  responses: {
    200: json(z.array(packSchema), "Every pack, with its number of cards"),
    404: notFound,
  },
});

const createPackRoute = createRoute({
  method: "post",
  path: "/admin/packs",
  operationId: "createPack",
  request: { body: body(packInputSchema) },
  responses: {
    201: json(packSchema, "The new pack"),
    400: errorResponse("Invalid pack"),
    404: notFound,
  },
});

const updatePackRoute = createRoute({
  method: "patch",
  path: "/admin/packs/{id}",
  operationId: "updatePack",
  request: {
    params: z.object({ id: z.string() }),
    body: body(packInputSchema),
  },
  responses: {
    200: json(packSchema, "The pack, changed"),
    400: errorResponse("Invalid pack"),
    404: notFound,
  },
});

const REFUSALS = {
  "unknown-pack": "Unknown pack",
  "game-changed": "A card keeps its mini-game",
};

// Password guessing is slowed twice: per client address here, and by the cost
// of each hash (apps/bff/src/password.ts).
const ADMIN_ATTEMPTS_PER_CLIENT = { limit: 10, windowSeconds: 15 * 60 };

// A hash costs about 30 MB and a fifth of a second on a thread the whole
// server shares. Clients that change address for each attempt escape the
// limit above, so only a few hashes run at once: the others are told to wait,
// and the public site keeps answering.
const MAX_HASHES_AT_ONCE = 2;
const BUSY = Symbol("busy");
let hashes = 0;
async function hashing<T>(work: () => Promise<T>): Promise<T | typeof BUSY> {
  if (hashes >= MAX_HASHES_AT_ONCE) return BUSY;
  hashes++;
  try {
    return await work();
  } finally {
    hashes--;
  }
}

/** Reports are anonymous, so they're limited per client address instead. */
const REPORTS_PER_CLIENT = { limit: 20, windowSeconds: 60 * 60 };
/** Likes arrive in batches, one per game or so. */
const LIKES_PER_CLIENT = { limit: 30, windowSeconds: 60 * 60 };

const publicApi = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Invalid request", issues: result.error.issues },
        400,
      );
    }
  },
})
  // Public on purpose, for load balancers and uptime checks: it says only
  // whether the app can reach its database. 503 tells them to stop sending traffic.
  .openapi(healthRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    return (await isDatabaseReachable())
      ? c.json({ status: "ok" as const }, 200)
      : c.json({ status: "unavailable" as const }, 503);
  })
  .openapi(meRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const user = await getSessionUser(c);
    return c.json(
      {
        user: user
          ? { email: user.email, name: user.name, isAdmin: isAdmin(user) }
          : null,
      },
      200,
    );
  })
  // Public on purpose: the game has no accounts, and a player reports a card
  // without signing in. The address is only used to count, never stored.
  .openapi(createReportRoute, async (c) => {
    const ip = clientIp(c.req.raw.headers) ?? "unknown";
    if (!(await hit(`report:client:${ip}`, REPORTS_PER_CLIENT))) {
      return c.json({ error: "Too many reports" }, 429);
    }
    await createReport(c.req.valid("json"));
    return c.body(null, 204);
  })
  // Public on purpose, like reports: a player likes a card without an
  // account. Counted per card, with nothing about who liked it.
  .openapi(likeCardsRoute, async (c) => {
    const ip = clientIp(c.req.raw.headers) ?? "unknown";
    if (!(await hit(`like:client:${ip}`, LIKES_PER_CLIENT))) {
      return c.json({ error: "Too many likes" }, 429);
    }
    await likeCards(c.req.valid("json").cardIds);
    return c.body(null, 204);
  })
  // Public on purpose: the deck is what every player plays with. Unchanged
  // since the client's copy (If-None-Match), it isn't sent again.
  .openapi(deckRoute, async (c) => {
    const deck = await publishedDeck();
    const etag = `"${deck.version}"`;
    c.header("Cache-Control", "no-cache");
    c.header("ETag", etag);
    if (c.req.header("If-None-Match") === etag) return c.body(null, 304);
    return c.json(deck, 200);
  })
  // Public on purpose: the three routes of the admin's sign-in page. They say
  // nothing about the account beyond "a password is still to be chosen".
  .openapi(adminStatusRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ setupNeeded: await adminSetupNeeded() }, 200);
  })
  .openapi(adminSetupRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const ip = clientIp(c.req.raw.headers) ?? "unknown";
    if (!(await hit(`admin:client:${ip}`, ADMIN_ATTEMPTS_PER_CLIENT))) {
      return c.json({ error: "Too many attempts" }, 429);
    }
    const userId = await hashing(() => setUpAdmin(c.req.valid("json")));
    if (userId === BUSY) return c.json({ error: "Too many attempts" }, 429);
    if (!userId) return c.json({ error: "Refused" }, 403);
    const session = await createSession(userId, undefined);
    setSessionCookie(c, session.token, session.expiresAt);
    return c.body(null, 204);
  })
  .openapi(adminLoginRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const ip = clientIp(c.req.raw.headers) ?? "unknown";
    if (!(await hit(`admin:client:${ip}`, ADMIN_ATTEMPTS_PER_CLIENT))) {
      return c.json({ error: "Too many attempts" }, 429);
    }
    const userId = await hashing(() => logInAdmin(c.req.valid("json")));
    if (userId === BUSY) return c.json({ error: "Too many attempts" }, 429);
    if (!userId) return c.json({ error: "Wrong email or password" }, 403);
    const session = await createSession(userId, undefined);
    setSessionCookie(c, session.token, session.expiresAt);
    return c.body(null, 204);
  });

const requireAdmin: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const user = await getSessionUser(c);
  if (!isAdmin(user)) return c.json({ error: "Not found" }, 404);
  c.set("user", user);
  c.header("Cache-Control", "no-store");
  await next();
};

/** Who to name in the history: the admin making this request. */
const adminEmail = (c: Context<ApiEnv>) => c.var.user.email ?? "admin";

const adminApi = new OpenAPIHono<ApiEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Invalid request", issues: result.error.issues },
        400,
      );
    }
  },
});

// A hidden page isn't a protection: every admin route checks that the caller
// is signed in and is the admin. Anyone else gets the 404 of a path that
// doesn't exist, signed in or not. (The sign-in routes above answer before
// this is reached.) This refuses access; it doesn't hide that an admin
// exists, which the public API document and the sign-in page show anyway.
adminApi.use("/admin/*", requireAdmin);

adminApi
  .openapi(listReportsRoute, async (c) => {
    return c.json(await listReports(c.req.valid("query").status), 200);
  })
  .openapi(updateReportRoute, async (c) => {
    const id = z.uuid().safeParse(c.req.valid("param").id);
    const report = id.success
      ? await setReportStatus(id.data, c.req.valid("json").status)
      : undefined;
    if (!report) return c.json({ error: "Not found" }, 404);
    return c.json(report, 200);
  })
  .openapi(listCardsRoute, async (c) => c.json(await listCards(), 200))
  .openapi(createCardRoute, async (c) => {
    const card = await createCard(c.req.valid("json"), adminEmail(c));
    if (typeof card === "string") {
      return c.json({ error: REFUSALS[card] }, 400);
    }
    return c.json(card, 201);
  })
  // Before /admin/cards/{id}, which would take "bulk" for a card.
  .openapi(bulkCardsRoute, async (c) => {
    const changed = await updateCards(c.req.valid("json"), adminEmail(c));
    if (typeof changed === "string") {
      return c.json({ error: REFUSALS[changed] }, 400);
    }
    return c.json({ changed }, 200);
  })
  .openapi(updateCardRoute, async (c) => {
    const card = await updateCard(
      c.req.valid("param").id,
      c.req.valid("json"),
      adminEmail(c),
    );
    if (!card) return c.json({ error: "Not found" }, 404);
    if (typeof card === "string") {
      return c.json({ error: REFUSALS[card] }, 400);
    }
    return c.json(card, 200);
  })
  .openapi(listChangesRoute, async (c) =>
    c.json(await listChanges(c.req.valid("query").cardId), 200),
  )
  .openapi(listPacksRoute, async (c) => c.json(await listPacks(), 200))
  .openapi(createPackRoute, async (c) =>
    c.json(await createPack(c.req.valid("json")), 201),
  )
  .openapi(updatePackRoute, async (c) => {
    const pack = await updatePack(c.req.valid("param").id, c.req.valid("json"));
    if (!pack) return c.json({ error: "Not found" }, 404);
    return c.json(pack, 200);
  });

export const api = new OpenAPIHono();
api.route("/", publicApi);
api.route("/", adminApi);

/** The OpenAPI document for this API, with paths under /api. */
export function openApiDocument() {
  const document = new OpenAPIHono();
  document.route("/api", api);
  return document.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "Zbeul API", version: "1.0.0" },
  });
}
