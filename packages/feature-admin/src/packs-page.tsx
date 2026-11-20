import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import {
  getListPacksQueryKey,
  throwUnexpected,
  useCreatePack,
  useListPacks,
  useUpdatePack,
} from "@zbeul/api";
import { packInputSchema, type Pack } from "@zbeul/core";
import { Button, Card, Field, FieldError, FieldLabel, Input } from "@zbeul/ui";
import { AdminSection, Loading } from "./layout";

type FormInput = z.input<typeof packInputSchema>;
type FormOutput = z.output<typeof packInputSchema>;

/** The packs: what players can choose to play with. All free. */
export function PacksPage() {
  // Asked again on arrival: the counts change when cards do.
  const packs = useListPacks({
    query: { throwOnError: throwUnexpected(404), staleTime: 0 },
  });
  return (
    <AdminSection
      className="page-section py-0"
      title="Packs"
      intro="Un pack publié qui a des cartes publiées est proposé aux joueurs. Tous sont gratuits."
    >
      {!packs.data ? (
        <Loading />
      ) : (
        <ul className="flex flex-col gap-3">
          {packs.data.map((pack) => (
            <li key={pack.id} data-testid="pack">
              <PackForm pack={pack} />
            </li>
          ))}
          <li>
            <PackForm />
          </li>
        </ul>
      )}
    </AdminSection>
  );
}

function PackForm({ pack }: { pack?: Pack }) {
  const queryClient = useQueryClient();
  const create = useCreatePack();
  const update = useUpdatePack();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(packInputSchema),
    defaultValues: pack ?? { name: "", description: "", published: false },
  });

  const onSubmit = handleSubmit(async (input) => {
    setMessage(null);
    try {
      if (pack) {
        await update.mutateAsync({ id: pack.id, data: input });
        setMessage({ ok: true, text: "Enregistré." });
      } else {
        await create.mutateAsync({ data: input });
        reset();
      }
    } catch {
      setMessage({ ok: false, text: "Ça n'a pas marché. Réessaie." });
    }
    await queryClient.invalidateQueries({ queryKey: getListPacksQueryKey() });
  });

  return (
    <Card className="p-4">
      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-3"
      >
        <h2 className="font-display text-lg font-extrabold">
          {pack ? pack.name : "Nouveau pack"}
        </h2>
        {pack && (
          <p className="text-muted-foreground text-sm">
            {pack.publishedCards} carte{pack.publishedCards > 1 ? "s" : ""}{" "}
            publiée{pack.publishedCards > 1 ? "s" : ""} sur {pack.cards}.
          </p>
        )}
        <Field invalid={!!errors.name}>
          <FieldLabel>Nom</FieldLabel>
          <Input {...register("name")} />
          <FieldError match={!!errors.name}>
            Donne un nom au pack (60 caractères au plus).
          </FieldError>
        </Field>
        <Field invalid={!!errors.description}>
          <FieldLabel>Description</FieldLabel>
          <Input {...register("description")} />
          <FieldError match={!!errors.description}>
            200 caractères au plus.
          </FieldError>
        </Field>
        <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="accent-primary size-5"
            {...register("published")}
          />
          Publié : proposé aux joueurs
        </label>
        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={
              message.ok
                ? "text-success-soft-foreground text-sm"
                : "text-destructive-soft-foreground text-sm"
            }
          >
            {message.text}
          </p>
        )}
        <div>
          <Button type="submit" disabled={isSubmitting}>
            {pack ? "Enregistrer" : "Créer le pack"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
