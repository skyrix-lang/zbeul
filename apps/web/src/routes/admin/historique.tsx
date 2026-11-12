import { createFileRoute } from "@tanstack/react-router";
import { HistoryPage } from "@zbeul/feature-admin";
import { usePageMeta } from "../../page-meta";

export const Route = createFileRoute("/admin/historique")({
  component: function HistoryRoute() {
    usePageMeta({ title: "Historique | Admin", noindex: true });
    return <HistoryPage />;
  },
});
