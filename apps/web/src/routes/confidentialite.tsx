import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@zbeul/feature-game";
import { usePageMeta } from "../page-meta";

// A public page, readable before the age gate.
export const Route = createFileRoute("/confidentialite")({
  component: function LegalRoute() {
    usePageMeta({ title: "Confidentialité" });
    return <LegalPage page="privacy" />;
  },
});
