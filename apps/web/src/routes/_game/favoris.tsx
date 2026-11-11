import { createFileRoute } from "@tanstack/react-router";
import { FavoritesPage } from "@zbeul/feature-game";
import { pageFor } from "../../overrides";
import { usePageMeta } from "../../page-meta";

const Page = pageFor("/favoris", FavoritesPage);

export const Route = createFileRoute("/_game/favoris")({
  component: function FavoritesPageRoute() {
    usePageMeta({ title: "Favoris", noindex: true });
    return <Page />;
  },
});
