import { createFileRoute } from "@tanstack/react-router";
import { SetupPage } from "@zbeul/feature-game";
import { pageFor } from "../../overrides";
import { usePageMeta } from "../../page-meta";

const Page = pageFor("/jouer", SetupPage);

export const Route = createFileRoute("/_game/jouer")({
  component: function SetupPageRoute() {
    usePageMeta({ title: "Nouvelle partie", noindex: true });
    return <Page />;
  },
});
