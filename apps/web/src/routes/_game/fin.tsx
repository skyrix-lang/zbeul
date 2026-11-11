import { createFileRoute } from "@tanstack/react-router";
import { EndPage } from "@zbeul/feature-game";
import { pageFor } from "../../overrides";
import { usePageMeta } from "../../page-meta";

const Page = pageFor("/fin", EndPage);

export const Route = createFileRoute("/_game/fin")({
  component: function EndPageRoute() {
    usePageMeta({ title: "Classement", noindex: true });
    return <Page />;
  },
});
