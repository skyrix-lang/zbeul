import { EllipsisVertical, PlusSquare, Share } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@zbeul/ui";
import { Screen, Section } from "../components/screen";

// Chrome on Android offers the install itself, through an event that fires
// once, early. The app keeps it (apps/web/src/main.tsx calls
// captureInstallPrompt) until this page's button uses it. Safari has no such
// event: on an iPhone, installing is a manual gesture.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<unknown>;
}

let installPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    changed();
  });
}

function useInstallPrompt() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => installPrompt,
  );
}

function Step({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="marker:text-primary-soft-foreground pl-1 marker:font-bold">
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {children}
        {icon}
      </span>
    </li>
  );
}

export function InstallPage() {
  const prompt = useInstallPrompt();

  return (
    <Screen
      title="Installer l'appli"
      intro="Zbeul se pose sur ton écran d'accueil comme une vraie appli : plein écran, et jouable sans réseau. Pas de store, pas de compte."
    >
      <p className="bg-success-soft text-success-soft-foreground hidden rounded-lg p-4 font-semibold installed:block">
        C'est déjà fait : tu es dans l'appli installée. Rien à faire de plus.
      </p>

      {prompt && (
        <Button
          size="xl"
          onClick={() => {
            void prompt.prompt();
            installPrompt = null;
            changed();
          }}
        >
          Installer maintenant
        </Button>
      )}

      <Section title="Sur iPhone" hint="Dans Safari.">
        <ol className="flex list-decimal flex-col gap-3 pl-6">
          <Step icon={<Share aria-hidden="true" className="size-5" />}>
            Touche <strong>Partager</strong>, en bas de l'écran
          </Step>
          <Step icon={<PlusSquare aria-hidden="true" className="size-5" />}>
            Choisis <strong>Sur l'écran d'accueil</strong>
          </Step>
          <Step>
            Valide avec <strong>Ajouter</strong>. L'icône Zbeul t'attend.
          </Step>
        </ol>
        <p className="text-muted-foreground text-sm">
          Recommandé sur iPhone : installée, l'appli garde mieux tes joueurs,
          tes favoris et ta partie en cours. Dans Safari, l'iPhone peut effacer
          les données d'un site que tu n'as pas ouvert depuis une semaine.
        </p>
      </Section>

      <Section title="Sur Android" hint="Dans Chrome.">
        <ol className="flex list-decimal flex-col gap-3 pl-6">
          <Step
            icon={<EllipsisVertical aria-hidden="true" className="size-5" />}
          >
            Ouvre le <strong>menu</strong>, en haut à droite
          </Step>
          <Step>
            Choisis <strong>Installer l'application</strong> ou{" "}
            <strong>Ajouter à l'écran d'accueil</strong>
          </Step>
          <Step>
            Valide avec <strong>Installer</strong>. C'est tout.
          </Step>
        </ol>
      </Section>
    </Screen>
  );
}
