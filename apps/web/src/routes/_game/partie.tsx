import { createFileRoute } from "@tanstack/react-router";
import { PlayPage } from "@zbeul/feature-game";
import { pageFor } from "../../overrides";
import { usePageMeta } from "../../page-meta";

const Page = pageFor("/partie", PlayPage);

export const Route = createFileRoute("/_game/partie")({
  component: function PlayPageRoute() {
    usePageMeta({ title: "Partie en cours", noindex: true });
    return <Page />;
  },
});
