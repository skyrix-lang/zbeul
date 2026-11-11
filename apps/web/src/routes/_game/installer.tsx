import { createFileRoute } from "@tanstack/react-router";
import { InstallPage } from "@zbeul/feature-game";
import { pageFor } from "../../overrides";
import { usePageMeta } from "../../page-meta";

const Page = pageFor("/installer", InstallPage);

export const Route = createFileRoute("/_game/installer")({
  component: function InstallPageRoute() {
    usePageMeta({ title: "Installer l'appli", noindex: true });
    return <Page />;
  },
});
