import { createFileRoute } from "@tanstack/react-router";
import { CardFormPage } from "@zbeul/feature-admin";
import { renderCard } from "../../../admin-card";
import { usePageMeta } from "../../../page-meta";

export const Route = createFileRoute("/admin/cartes/$cardId")({
  component: function CardRoute() {
    const { cardId } = Route.useParams();
    usePageMeta({ title: `Carte ${cardId} | Admin`, noindex: true });
    return <CardFormPage cardId={cardId} renderCard={renderCard} />;
  },
});
