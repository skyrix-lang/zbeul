import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@zbeul/feature-game";
import { usePageMeta } from "../page-meta";

// A public page, readable before the age gate.
export const Route = createFileRoute("/charte")({
  component: function LegalRoute() {
    usePageMeta({ title: "Charte de contenu" });
    return <LegalPage page="charter" />;
  },
});
