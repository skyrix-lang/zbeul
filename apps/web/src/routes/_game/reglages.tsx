import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@zbeul/feature-game";
import { version } from "../../../package.json";
import { pageFor } from "../../overrides";
import { usePageMeta } from "../../page-meta";

const Page = pageFor("/reglages", SettingsPage);

export const Route = createFileRoute("/_game/reglages")({
  component: function SettingsRoute() {
    usePageMeta({ title: "Réglages", noindex: true });
    return <Page version={version} />;
  },
});
