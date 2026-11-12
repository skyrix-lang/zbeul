import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import {
  getListCardChangesQueryKey,
  getListCardsQueryKey,
  throwUnexpected,
  useCreateCard,
  useListCardChanges,
  useListCards,
  useListPacks,
  useUpdateCard,
} from "@zbeul/api";
import {
  AUDIENCES,
  CARD_PREFIXES,
  CARD_STATUSES,
  CARD_TARGETS,
  cardInputSchema,
  CONTENT_THEMES,
  countTargets,
  LEVEL_NAMES,
  LEVELS,
  MINI_GAME_LABELS,
  MINI_GAMES,
  THEME_LABELS,
  type AdminCard,
  type Pack,
} from "@zbeul/core";
import {
  Button,
  buttonVariants,
  Card,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Textarea,
} from "@zbeul/ui";
import {
  dateFormat,
  describeChange,
  STATUS_LABELS,
  toCard,
  type RenderCard,
} from "./labels";
import { AdminSection, Loading, selectClass } from "./layout";

type FormInput = z.input<typeof cardInputSchema>;
type FormOutput = z.output<typeof cardInputSchema>;

const AUDIENCE_LABELS = {
  gars: "Les gars",
  filles: "Les filles",
  autres: "Les autres",
};

const emptyToNull = (value: string) => (value === "" ? null : value);

/** A new card, or an existing one when `cardId` is given. */
export function CardFormPage({
  cardId,
  renderCard,
}: {
  cardId?: string;
  renderCard: RenderCard;
}) {
  const cards = useListCards({ query: { throwOnError: throwUnexpected(404) } });
  const packs = useListPacks({
    query: { throwOnError: throwUnexpected(404), staleTime: 0 },
  });
  if (!cards.data || !packs.data) return <Loading />;

  const card = cardId
    ? cards.data.find((other) => other.id === cardId)
    : undefined;
  if (cardId && !card) {
    return (
      <AdminSection title="Carte introuvable">
        <p className="text-muted-foreground">
          Aucune carte ne porte la référence {cardId}.
        </p>
        <Link to="/admin/cartes" className={buttonVariants()}>
          Retour aux cartes
        </Link>
      </AdminSection>
    );
  }
  return (
    <CardForm
      // A form of its own for each card.
      key={card?.id ?? "new"}
      card={card}
      packs={packs.data}
      renderCard={renderCard}
    />
  );
}

function CardForm({
  card,
  packs,
  renderCard,
}: {
  card: AdminCard | undefined;
  packs: Pack[];
  renderCard: RenderCard;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useCreateCard();
  const update = useUpdateCard();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(cardInputSchema),
    defaultValues: card
      ? { ...card }
      : {
          game: "tu-preferes",
          level: 1,
          text: "",
          themes: [],
          packId: packs[0]?.id ?? "",
          status: "draft",
          audience: null,
          doubleTier: false,
          witness: false,
          ruleDuration: null,
          answer: "",
          unit: "",
          source: "",
        },
  });
  const values = useWatch({ control });
  const game = values.game ?? "tu-preferes";
  const [min, max] = CARD_TARGETS[game];

  const onSubmit = handleSubmit(async (input) => {
    setMessage(null);
    try {
      if (card) {
        await update.mutateAsync({ id: card.id, data: input });
        setMessage({ ok: true, text: "Enregistré." });
      } else {
        const created = await create.mutateAsync({ data: input });
        await navigate({
          to: "/admin/cartes/$cardId",
          params: { cardId: created.id },
        });
      }
    } catch {
      setMessage({ ok: false, text: "Le serveur a refusé. Vérifie la carte." });
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() }),
      queryClient.invalidateQueries({
        queryKey: getListCardChangesQueryKey().slice(0, 1),
      }),
    ]);
  });

  // The card as it would be played, when the text makes sense so far.
  const text = values.text ?? "";
  const preview =
    text.trim().length >= 3 && countTargets(text) !== null
      ? toCard({
          id: card?.id ?? `${CARD_PREFIXES[game]}-000`,
          game,
          level: Number(values.level ?? 1) as AdminCard["level"],
          text,
          themes: [],
          audience: values.audience ?? null,
          doubleTier: values.doubleTier ?? false,
          witness: values.witness ?? false,
          ruleDuration: Number(values.ruleDuration) || null,
          answer: values.answer ?? null,
          unit: values.unit ?? null,
          source: values.source ?? null,
        })
      : null;

  return (
    <AdminSection
      title={card ? `Carte ${card.id}` : "Nouvelle carte"}
      intro={
        card
          ? `${MINI_GAME_LABELS[card.game]}. Modifiée le ${dateFormat.format(new Date(card.updatedAt))}.`
          : "Sa référence est attribuée à l'enregistrement."
      }
      action={
        <Link
          to="/admin/cartes"
          className={buttonVariants({ variant: "ghost" })}
        >
          Retour aux cartes
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          noValidate
          onSubmit={(event) => void onSubmit(event)}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Mini-jeu
              <select
                // The reference says which mini-game a card is: it stays.
                disabled={!!card}
                className={selectClass}
                {...register("game")}
              >
                {MINI_GAMES.map((option) => (
                  <option key={option} value={option}>
                    {MINI_GAME_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Niveau
              <select
                className={selectClass}
                {...register("level", { valueAsNumber: true })}
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level} · {LEVEL_NAMES[level]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Field invalid={!!errors.text}>
            <FieldLabel>Texte</FieldLabel>
            <Textarea rows={5} className="text-base" {...register("text")} />
            <FieldDescription>
              {max === 0
                ? "Ce mini-jeu ne cite aucun joueur."
                : `Joueurs cités : ${min === max ? min : `${min} à ${max}`}, avec [J1]${max > 1 ? ` à [J${max}]` : ""}.`}{" "}
              Accord : [il/elle/iel].
              {game === "regle" && " Durée de la règle : [durée]."} Pas de
              nombre de gorgées : le jeu le calcule.
            </FieldDescription>
            <FieldError match={!!errors.text}>
              {errors.text?.message ?? "Écris le texte de la carte."}
            </FieldError>
          </Field>

          {game === "culture-g" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field invalid={!!errors.answer}>
                  <FieldLabel>Réponse</FieldLabel>
                  <Input {...register("answer", { setValueAs: emptyToNull })} />
                  <FieldError match={!!errors.answer}>
                    {errors.answer?.message}
                  </FieldError>
                </Field>
                <Field invalid={!!errors.unit}>
                  <FieldLabel>Unité</FieldLabel>
                  <Input {...register("unit", { setValueAs: emptyToNull })} />
                  <FieldError match={!!errors.unit}>
                    {errors.unit?.message}
                  </FieldError>
                </Field>
              </div>
              <Field invalid={!!errors.source}>
                <FieldLabel>Source</FieldLabel>
                <Input {...register("source", { setValueAs: emptyToNull })} />
                <FieldDescription>
                  Organisme, année, titre : une question sans chiffre sourcé
                  n'est pas publiée.
                </FieldDescription>
                <FieldError match={!!errors.source}>
                  {errors.source?.message}
                </FieldError>
              </Field>
            </>
          )}

          {game === "regle" && (
            <Field invalid={!!errors.ruleDuration}>
              <FieldLabel>Durée de la règle, en cartes</FieldLabel>
              <Input
                type="number"
                min={1}
                max={50}
                placeholder="10"
                className="w-28"
                {...register("ruleDuration", {
                  setValueAs: (value: string | number | null) =>
                    value === "" || value === null ? null : Number(value),
                })}
              />
              <FieldError match={!!errors.ruleDuration}>
                Entre 1 et 50 cartes.
              </FieldError>
            </Field>
          )}

          {game === "tout-le-monde" && (
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Carte de genre
                <select
                  className={selectClass}
                  {...register("audience", { setValueAs: emptyToNull })}
                >
                  <option value="">Non, pour tout le monde</option>
                  {AUDIENCES.map((audience) => (
                    <option key={audience} value={audience}>
                      {AUDIENCE_LABELS[audience]} (gorgées uniquement)
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="accent-primary size-5"
                  {...register("doubleTier")}
                />
                Double palier : le second groupe boit le double
              </label>
            </div>
          )}

          {game === "action-verite" && (
            <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="accent-primary size-5"
                {...register("witness")}
              />
              Peut faire parler ou boire un témoin
            </label>
          )}

          <fieldset>
            <legend className="text-sm font-medium">
              Thèmes (pour les exclusions des joueurs)
            </legend>
            <div className="mt-1 grid grid-cols-2 gap-x-3">
              {CONTENT_THEMES.map((theme) => (
                <label
                  key={theme}
                  className="flex min-h-9 items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    value={theme}
                    className="accent-primary size-5"
                    {...register("themes")}
                  />
                  {THEME_LABELS[theme]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Pack
              <select className={selectClass} {...register("packId")}>
                {packs.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Statut
              <select className={selectClass} {...register("status")}>
                {CARD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {message && (
            <p
              role={message.ok ? "status" : "alert"}
              className={
                message.ok
                  ? "bg-success-soft text-success-soft-foreground rounded-md px-3 py-2 text-sm"
                  : "bg-destructive-soft text-destructive-soft-foreground rounded-md px-3 py-2 text-sm"
              }
            >
              {message.text}
            </p>
          )}
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {card ? "Enregistrer" : "Créer la carte"}
          </Button>
        </form>

        <section aria-label="Aperçu" className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-extrabold">Aperçu</h2>
          {preview ? (
            <>
              <p className="text-muted-foreground text-sm">
                Début de partie, en gorgées
              </p>
              {renderCard(preview, { sips: true, stake: 1 })}
              <p className="text-muted-foreground text-sm">
                Fin de partie, en gorgées
              </p>
              {renderCard(preview, { sips: true, stake: 5 })}
              <p className="text-muted-foreground text-sm">Aux points</p>
              {renderCard(preview, { sips: false, stake: 3 })}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              L'aperçu arrive dès que le texte tient debout.
            </p>
          )}
          {card && <CardHistory cardId={card.id} />}
        </section>
      </div>
    </AdminSection>
  );
}

function CardHistory({ cardId }: { cardId: string }) {
  const changes = useListCardChanges(
    { cardId },
    { query: { throwOnError: throwUnexpected(404) } },
  );
  return (
    <>
      <h2 className="font-display mt-4 text-xl font-extrabold">Historique</h2>
      {!changes.data ? (
        <Loading />
      ) : changes.data.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Jamais modifiée depuis sa création avec le jeu.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {changes.data.map((change) => (
            <li key={change.id}>
              <Card className="p-3 text-sm">
                <p className="text-muted-foreground">
                  {dateFormat.format(new Date(change.createdAt))} ·{" "}
                  {change.adminEmail}
                </p>
                <p>{describeChange(change).join(" ; ")}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
