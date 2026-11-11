import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { reportStatusSchema } from "@zbeul/core";
import { AdminPage } from "@zbeul/feature-admin";
import { CardPreview } from "@zbeul/feature-game";
import { NotFoundPage } from "../components/not-found";
import { usePageMeta } from "../page-meta";

// The hidden admin: no link leads here, it is never indexed, and the service
// worker never serves it offline (vite.config.ts). There is no redirect to a
// sign-in page: the page itself asks for the password, and shows "page not
// found" to a signed-in visitor who isn't the admin. The BFF checks every
// admin request again.

// An unknown status lists the reports still to read.
const searchSchema = z.object({
  status: reportStatusSchema.optional().catch(undefined),
});

export const Route = createFileRoute("/admin")({
  validateSearch: searchSchema,
  component: function AdminRoute() {
    usePageMeta({ title: "Admin", noindex: true });
    const { status = "open" } = Route.useSearch();
    return (
      <AdminPage
        status={status}
        notFound={<NotFoundPage />}
        renderCard={(cardId) => <CardPreview cardId={cardId} />}
      />
    );
  },
});
