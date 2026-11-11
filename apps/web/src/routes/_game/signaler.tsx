import { createFileRoute } from "@tanstack/react-router";
import { ReportPage } from "@zbeul/feature-game";
import { pageFor } from "../../overrides";
import { usePageMeta } from "../../page-meta";

const Page = pageFor("/signaler", ReportPage);

export const Route = createFileRoute("/_game/signaler")({
  component: function ReportPageRoute() {
    usePageMeta({ title: "Signaler un problème", noindex: true });
    return <Page />;
  },
});
