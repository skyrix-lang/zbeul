import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@zbeul/feature-game";
import { version } from "../../../package.json";
import { pageFor } from "../../overrides";
import { openConsentSettings, useConsent } from "../../analytics";
import { CONSENT_SETTINGS_ID } from "../../components/consent-banner";
import { usePageMeta } from "../../page-meta";

const Page = pageFor("/reglages", SettingsPage);

export const Route = createFileRoute("/_game/reglages")({
  component: function SettingsRoute() {
    usePageMeta({ title: "Réglages", noindex: true });
    // Only when there is analytics to consent to.
    const { enabled } = useConsent();
    return (
      <Page
        version={version}
        cookieSettings={
          enabled
            ? { id: CONSENT_SETTINGS_ID, open: openConsentSettings }
            : undefined
        }
      />
    );
  },
});
