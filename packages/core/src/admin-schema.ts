import { z } from "zod";
import { REPORT_REASONS } from "./report-schema";

// The admin: one account for now, which signs in with a password. Shared by
// the BFF (validation) and the admin's forms.

export const PASSWORD_MIN_LENGTH = 12;

/** What a password must have, each with the message shown when it's missing. */
export const PASSWORD_RULES = [
  {
    id: "length",
    label: `Au moins ${PASSWORD_MIN_LENGTH} caractères`,
    test: (password: string) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "lower",
    label: "Une minuscule",
    test: (password: string) => /\p{Ll}/u.test(password),
  },
  {
    id: "upper",
    label: "Une majuscule",
    test: (password: string) => /\p{Lu}/u.test(password),
  },
  {
    id: "digit",
    label: "Un chiffre",
    test: (password: string) => /\d/.test(password),
  },
  {
    id: "symbol",
    label: "Un caractère spécial",
    test: (password: string) => /[^\p{L}\d\s]/u.test(password),
  },
] as const;

export const passwordSchema = z
  .string()
  // Long passphrases are welcome; the limit only bounds the hashing work.
  .max(200)
  .superRefine((password, context) => {
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(password)) {
        context.addIssue({ code: "custom", message: rule.label });
      }
    }
  });

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** The first sign-in: the admin chooses their password, with the setup code. */
export const adminSetupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    /** Proves who is setting the password: only the server's owner has it. */
    code: z.string().trim().min(1).max(200),
  })
  .refine(
    ({ email, password }) => {
      // The name before the @ and any +tag. Too short to mean anything ("me",
      // "a"), it isn't checked: it would refuse ordinary words.
      const name = email.split("@")[0]!.split("+")[0]!;
      return name.length < 4 || !password.toLowerCase().includes(name);
    },
    { message: "Pas ton adresse dans le mot de passe", path: ["password"] },
  )
  .meta({ id: "AdminSetup" });

export const adminLoginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(200) })
  .meta({ id: "AdminLogin" });

export type AdminSetupInput = z.infer<typeof adminSetupSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

/** What became of a report: still to read, dealt with, or set aside. */
export const REPORT_STATUSES = ["open", "handled", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const reportStatusSchema = z
  .enum(REPORT_STATUSES)
  .meta({ id: "ReportStatus" });

export const reportSchema = z
  .object({
    id: z.uuid(),
    cardId: z.string().nullable(),
    message: z.string(),
    reasons: z.array(z.enum(REPORT_REASONS)),
    status: reportStatusSchema,
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "Report" });

export const updateReportSchema = z
  .object({ status: reportStatusSchema })
  .meta({ id: "UpdateReport" });

export type Report = z.infer<typeof reportSchema>;
