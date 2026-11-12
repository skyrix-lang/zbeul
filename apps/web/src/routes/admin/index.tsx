import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { reportStatusSchema } from "@zbeul/core";
import { ReportsPage } from "@zbeul/feature-admin";
import { renderCard } from "../../admin-card";
import { usePageMeta } from "../../page-meta";

// An unknown status lists the reports still to read.
const searchSchema = z.object({
  status: reportStatusSchema.optional().catch(undefined),
});

export const Route = createFileRoute("/admin/")({
  validateSearch: searchSchema,
  component: function ReportsRoute() {
    usePageMeta({ title: "Admin", noindex: true });
    const { status = "open" } = Route.useSearch();
    return <ReportsPage status={status} renderCard={renderCard} />;
  },
});
