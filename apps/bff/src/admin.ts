import { timingSafeEqual } from "node:crypto";
import { desc, eq, isNull } from "drizzle-orm";
import type {
  AdminLoginInput,
  AdminSetupInput,
  Report,
  ReportStatus,
} from "@zbeul/core";
import { reports, users, userSessions } from "@zbeul/db";
import { getDb } from "./db";
import { env } from "./env";
import { hashPassword, verifyPassword } from "./password";
import type { SessionUser } from "./session";

// The admin: one account, named by ADMIN_EMAIL, that signs in with a password
// (no identity provider, no email to send). The account has no password at
// first: whoever holds ADMIN_SETUP_CODE chooses it, once. Being signed in is
// not enough anywhere below: every admin route also checks `isAdmin`.

const sameText = (a: string, b: string) => {
  const [left, right] = [Buffer.from(a), Buffer.from(b)];
  return left.length === right.length && timingSafeEqual(left, right);
};

/** Whether this signed-in user is the admin named by the environment. */
export function isAdmin(user: SessionUser | null): user is SessionUser {
  const { ADMIN_EMAIL } = env();
  return !!user && !!ADMIN_EMAIL && user.isAdmin && user.email === ADMIN_EMAIL;
}

async function adminAccount() {
  const { ADMIN_EMAIL } = env();
  if (!ADMIN_EMAIL) return undefined;
  const [account] = await getDb()
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL));
  return account;
}

/** Whether the admin still has to choose a password. False without an admin. */
export async function adminSetupNeeded(): Promise<boolean> {
  const { ADMIN_EMAIL, ADMIN_SETUP_CODE } = env();
  if (!ADMIN_EMAIL || !ADMIN_SETUP_CODE) return false;
  return !(await adminAccount())?.passwordHash;
}

/**
 * Sets the admin's first password. Only for the admin's email, with the setup
 * code, and only while no password is set: the code is useless afterwards.
 * Returns the admin's user id, or null when refused (for any reason: the
 * caller answers the same way to all of them).
 */
export async function setUpAdmin(
  input: AdminSetupInput,
): Promise<string | null> {
  const { ADMIN_EMAIL, ADMIN_SETUP_CODE } = env();
  if (!ADMIN_EMAIL || !ADMIN_SETUP_CODE) return null;
  // Both compared in full, so a wrong code and a wrong email take as long.
  const codeOk = sameText(input.code, ADMIN_SETUP_CODE);
  const emailOk = sameText(input.email, ADMIN_EMAIL);
  if (!codeOk || !emailOk) return null;

  const passwordHash = await hashPassword(input.password);
  const db = getDb();
  const [admin] = await db
    .insert(users)
    .values({ email: ADMIN_EMAIL, passwordHash, isAdmin: true })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, isAdmin: true },
      // Never over a password that is already set: of two requests at once,
      // only the first one wins.
      setWhere: isNull(users.passwordHash),
    })
    .returning({ id: users.id });
  if (!admin) return null;
  // Any session opened for this email before it had a password ends here.
  await db.delete(userSessions).where(eq(userSessions.userId, admin.id));
  return admin.id;
}

/** The admin's user id when the email and password are right, else null. */
export async function logInAdmin(
  input: AdminLoginInput,
): Promise<string | null> {
  const { ADMIN_EMAIL } = env();
  const account =
    ADMIN_EMAIL && sameText(input.email, ADMIN_EMAIL)
      ? await adminAccount()
      : undefined;
  // Always hashes, account or not: see verifyPassword.
  const valid = await verifyPassword(input.password, account?.passwordHash);
  return valid && account ? account.id : null;
}

const reportColumns = {
  id: reports.id,
  cardId: reports.cardId,
  message: reports.message,
  status: reports.status,
  createdAt: reports.createdAt,
};

const toReport = (row: {
  id: string;
  cardId: string | null;
  message: string;
  status: ReportStatus;
  createdAt: Date;
}): Report => ({ ...row, createdAt: row.createdAt.toISOString() });

/** The reports with this status, the newest first. */
export async function listReports(status: ReportStatus): Promise<Report[]> {
  const rows = await getDb()
    .select(reportColumns)
    .from(reports)
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(200);
  return rows.map(toReport);
}

/** Files a report; undefined when there is no such report. */
export async function setReportStatus(
  id: string,
  status: ReportStatus,
): Promise<Report | undefined> {
  const [row] = await getDb()
    .update(reports)
    .set({ status })
    .where(eq(reports.id, id))
    .returning(reportColumns);
  return row && toReport(row);
}
