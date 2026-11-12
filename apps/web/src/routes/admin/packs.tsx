import { createFileRoute } from "@tanstack/react-router";
import { PacksPage } from "@zbeul/feature-admin";
import { usePageMeta } from "../../page-meta";

export const Route = createFileRoute("/admin/packs")({
  component: function PacksRoute() {
    usePageMeta({ title: "Packs | Admin", noindex: true });
    return <PacksPage />;
  },
});
