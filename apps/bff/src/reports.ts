import type { CreateReportInput } from "@zbeul/core";
import { reports } from "@zbeul/db";
import { getDb } from "./db";

// Reports are write-only for players: nobody reads them through the API yet.
// They hold no personal data, so there is no user to filter by.

export async function createReport(input: CreateReportInput): Promise<void> {
  await getDb()
    .insert(reports)
    .values({ cardId: input.cardId ?? null, message: input.message });
}
