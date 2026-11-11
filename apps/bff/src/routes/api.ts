import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import {
  adminLoginSchema,
  adminSetupSchema,
  bookingIdSchema,
  bookingSchema,
  bookingStatusSchema,
  createBookingSchema,
  createReportSchema,
  reportSchema,
  reportStatusSchema,
  updateBookingSchema,
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
import { createBooking, getBookings, updateBookingStatus } from "../bookings";
import { clientIp } from "../client-ip";
import { isDatabaseReachable } from "../health";
import { hit } from "../rate-limit";
import { createReport } from "../reports";
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

const unauthorized = errorResponse("Not signed in");

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

const listBookings = createRoute({
  method: "get",
  path: "/bookings",
  operationId: "listBookings",
  request: { query: z.object({ status: bookingStatusSchema.optional() }) },
  responses: {
    200: json(z.array(bookingSchema), "The user's bookings, in date order"),
    400: errorResponse("Invalid request"),
    401: unauthorized,
  },
});

const createBookingRoute = createRoute({
  method: "post",
  path: "/bookings",
  operationId: "createBooking",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createBookingSchema } },
    },
  },
  responses: {
    201: json(bookingSchema, "The new booking, always pending"),
    400: errorResponse("Invalid request"),
    401: unauthorized,
  },
});

const updateBookingRoute = createRoute({
  method: "patch",
  path: "/bookings/{id}",
  operationId: "updateBooking",
  request: {
    // Any string: an id that isn't a UUID is a booking that doesn't exist (404).
    params: z.object({ id: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: updateBookingSchema } },
    },
  },
  responses: {
    200: json(bookingSchema, "The updated booking"),
    400: errorResponse("Invalid request"),
    401: unauthorized,
    404: errorResponse("No such booking for this user"),
  },
});

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

// Password guessing is slowed twice: per client address here, and by the cost
// of each hash (apps/bff/src/password.ts).
const ADMIN_ATTEMPTS_PER_CLIENT = { limit: 10, windowSeconds: 15 * 60 };

/** Reports are anonymous, so they're limited per client address instead. */
const REPORTS_PER_CLIENT = { limit: 20, windowSeconds: 60 * 60 };

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
    const userId = await setUpAdmin(c.req.valid("json"));
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
    const userId = await logInAdmin(c.req.valid("json"));
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
// is signed in and is the admin. Anyone else gets the same 404 as for a path
// that doesn't exist, signed in or not. (The sign-in routes above answer
// before this is reached.)
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
  });

const userApi = new OpenAPIHono<ApiEnv>({
  // A request that fails its schema gets this API's error shape.
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Invalid request", issues: result.error.issues },
        400,
      );
    }
  },
});

// Each route checks the session: every one of them is a public endpoint.
userApi.use(async (c, next) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", user);
  c.header("Cache-Control", "no-store");
  await next();
});

userApi
  .openapi(listBookings, async (c) => {
    const { status } = c.req.valid("query");
    return c.json(await getBookings(c.var.user.id, status), 200);
  })
  .openapi(createBookingRoute, async (c) => {
    const booking = await createBooking(c.var.user.id, c.req.valid("json"));
    return c.json(booking, 201);
  })
  .openapi(updateBookingRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");
    const bookingId = bookingIdSchema.safeParse(id);
    const booking = bookingId.success
      ? await updateBookingStatus(c.var.user.id, bookingId.data, status)
      : undefined;
    if (!booking) return c.json({ error: "Booking not found" }, 404);
    return c.json(booking, 200);
  });

export const api = new OpenAPIHono();
api.route("/", publicApi);
// Before userApi, whose session check would answer 401 on the admin's paths.
api.route("/", adminApi);
api.route("/", userApi);

/** The OpenAPI document for this API, with paths under /api. */
export function openApiDocument() {
  const document = new OpenAPIHono();
  document.route("/api", api);
  return document.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "Zbeul API", version: "1.0.0" },
  });
}
