import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { createReportSchema } from "@zbeul/core";
import {
  Button,
  buttonVariants,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Textarea,
} from "@zbeul/ui";
import { Screen } from "../components/screen";
import { PATHS } from "../paths";
import { useSendReport } from "../reports";

type FormInput = z.input<typeof createReportSchema>;
type FormOutput = z.output<typeof createReportSchema>;

const DONE = {
  sent: "Bien reçu, merci. On lit tout, même les insultes.",
  kept: "Pas de réseau : c'est gardé sur ton téléphone et ça partira tout seul à la prochaine connexion.",
  refused:
    "Trop de signalements d'un coup depuis chez toi. Souffle, et réessaie dans une heure.",
};

/** A free-text report, with an optional card. Anonymous. */
export function ReportPage() {
  const send = useSendReport();
  const [done, setDone] = useState<keyof typeof DONE | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createReportSchema),
    defaultValues: { cardId: "", message: "" },
  });

  const onSubmit = handleSubmit(async (values) => setDone(await send(values)));

  return (
    <Screen
      title="Signaler un problème"
      back={PATHS.settings}
      intro="Une carte fausse ou déplacée, un bouton qui boude : raconte. C'est anonyme, rien sur toi ni sur ta partie ne part avec."
    >
      {done ? (
        <div className="flex flex-col gap-4">
          <p
            role="status"
            className="bg-card rounded-lg border p-4 font-semibold"
          >
            {DONE[done]}
          </p>
          <Link to={PATHS.home} className={buttonVariants({ size: "xl" })}>
            Retour à l'accueil
          </Link>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(event) => void onSubmit(event)}
          className="flex flex-col gap-5"
        >
          <Field invalid={!!errors.message}>
            <FieldLabel>Ton message</FieldLabel>
            <Textarea
              rows={6}
              maxLength={1000}
              className="text-base"
              {...register("message")}
            />
            <FieldError match={!!errors.message}>
              Dis-nous au moins quelques mots (et pas plus de 1000 caractères).
            </FieldError>
          </Field>
          <Field invalid={!!errors.cardId}>
            <FieldLabel>Carte concernée (facultatif)</FieldLabel>
            <Input
              placeholder="TP-001"
              autoCapitalize="characters"
              autoComplete="off"
              className="min-h-11 text-base"
              {...register("cardId", {
                setValueAs: (value: string) =>
                  value.trim().toUpperCase() || undefined,
              })}
            />
            <FieldDescription>
              Sa référence s'affiche quand tu touches le drapeau pendant une
              partie.
            </FieldDescription>
            <FieldError match={!!errors.cardId}>
              Une référence ressemble à TP-001.
            </FieldError>
          </Field>
          <Button type="submit" size="xl" disabled={isSubmitting}>
            Envoyer
          </Button>
        </form>
      )}
    </Screen>
  );
}
