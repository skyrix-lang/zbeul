import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { HomePage, useFlushReports } from "@zbeul/feature-game";
import { pageFor } from "../../overrides";
import { usePageMeta } from "../../page-meta";
import { applyUpdate } from "../../pwa";

// The one public page: index.html carries its title, description, canonical
// URL and structured data, so crawlers have them before JavaScript runs.

const Page = pageFor("/", HomePage);

export const Route = createFileRoute("/_game/")({
  component: function HomeRoute() {
    usePageMeta({});
    useFlushReports();
    // An update of the app waits for the home: never in the middle of a game.
    useEffect(applyUpdate, []);
    return <Page />;
  },
});
