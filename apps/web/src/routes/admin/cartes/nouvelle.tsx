import { createFileRoute } from "@tanstack/react-router";
import { CardFormPage } from "@zbeul/feature-admin";
import { renderCard } from "../../../admin-card";
import { usePageMeta } from "../../../page-meta";

export const Route = createFileRoute("/admin/cartes/nouvelle")({
  component: function NewCardRoute() {
    usePageMeta({ title: "Nouvelle carte | Admin", noindex: true });
    return <CardFormPage renderCard={renderCard} />;
  },
});
