import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Circle } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import {
  ApiError,
  getGetAdminStatusQueryKey,
  getGetMeQueryKey,
  useLogInAdmin,
  useSetUpAdmin,
} from "@zbeul/api";
import {
  adminLoginSchema,
  adminSetupSchema,
  PASSWORD_RULES,
} from "@zbeul/core";
import {
  Button,
  Card,
  cn,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
} from "@zbeul/ui";

// The admin's way in. The first time, the account has no password yet: the
// admin chooses one, proving who they are with the setup code from the
// server's configuration. Afterwards it is an ordinary sign-in.

const MESSAGES: Record<number, string> = {
  400: "Vérifie les champs : quelque chose ne va pas.",
  403: "Adresse, mot de passe ou code refusé.",
  429: "Trop d'essais. Réessaie dans un quart d'heure.",
};
const failure = (error: unknown) =>
  (error instanceof ApiError && MESSAGES[error.status]) ||
  "Impossible de joindre le serveur. Réessaie.";

/** After signing in, the page asks again who is there. */
function useSignedIn() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminStatusQueryKey() }),
    ]);
}

function Shell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-5">
      <Card className="flex flex-col gap-5">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{intro}</p>
        </div>
        {children}
      </Card>
    </main>
  );
}

function Problem({ message }: { message: string | null }) {
  return (
    message && (
      <p
        role="alert"
        className="bg-destructive-soft text-destructive-soft-foreground rounded-md px-3 py-2 text-sm"
      >
        {message}
      </p>
    )
  );
}

type LoginInput = z.input<typeof adminLoginSchema>;

export function AdminLogin() {
  const logIn = useLogInAdmin();
  const signedIn = useSignedIn();
  const [problem, setProblem] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      await logIn.mutateAsync({ data: values });
      await signedIn();
    } catch (error) {
      setProblem(failure(error));
    }
  });

  return (
    <Shell title="Admin" intro="Réservé à la personne qui tient la boutique.">
      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Field invalid={!!errors.email}>
          <FieldLabel>Adresse e-mail</FieldLabel>
          <Input
            type="email"
            autoComplete="username"
            className="min-h-11 text-base"
            {...register("email")}
          />
          <FieldError match={!!errors.email}>
            Entre une adresse e-mail.
          </FieldError>
        </Field>
        <Field invalid={!!errors.password}>
          <FieldLabel>Mot de passe</FieldLabel>
          <Input
            type="password"
            autoComplete="current-password"
            className="min-h-11 text-base"
            {...register("password")}
          />
          <FieldError match={!!errors.password}>
            Entre ton mot de passe.
          </FieldError>
        </Field>
        <Problem message={problem} />
        <Button type="submit" size="lg" disabled={isSubmitting}>
          Se connecter
        </Button>
      </form>
    </Shell>
  );
}

type SetupInput = z.input<typeof adminSetupSchema>;

/** The setup code can come in the link, after the #: it never reaches a log. */
function codeFromLink() {
  return new URLSearchParams(window.location.hash.slice(1)).get("code") ?? "";
}

export function AdminSetup() {
  const setUp = useSetUpAdmin();
  const signedIn = useSignedIn();
  const [problem, setProblem] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SetupInput>({
    resolver: zodResolver(adminSetupSchema),
    defaultValues: { email: "", password: "", code: codeFromLink() },
  });
  const password = useWatch({ control, name: "password" });

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      await setUp.mutateAsync({ data: values });
      // The code has done its job: out of the address bar.
      window.history.replaceState(null, "", window.location.pathname);
      await signedIn();
    } catch (error) {
      setProblem(failure(error));
    }
  });

  return (
    <Shell
      title="Première connexion"
      intro="Choisis le mot de passe du compte admin. Ça ne se fait qu'une fois."
    >
      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Field invalid={!!errors.email}>
          <FieldLabel>Adresse e-mail du compte admin</FieldLabel>
          <Input
            type="email"
            autoComplete="username"
            className="min-h-11 text-base"
            {...register("email")}
          />
          <FieldError match={!!errors.email}>
            Entre une adresse e-mail.
          </FieldError>
        </Field>
        <Field invalid={!!errors.password}>
          <FieldLabel>Nouveau mot de passe</FieldLabel>
          <Input
            type="password"
            autoComplete="new-password"
            className="min-h-11 text-base"
            {...register("password")}
          />
          <FieldError match={!!errors.password}>
            {errors.password?.message === "Pas ton adresse dans le mot de passe"
              ? "Pas ton adresse dans le mot de passe."
              : "Il manque encore quelque chose, voir la liste."}
          </FieldError>
          <ul
            aria-label="Ce qu'il faut dans le mot de passe"
            className="mt-1 flex flex-col gap-1 text-sm"
          >
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li
                  key={rule.id}
                  className={cn(
                    "flex items-center gap-2",
                    met
                      ? "text-success-soft-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {met ? (
                    <Check aria-label="OK :" className="size-4" />
                  ) : (
                    <Circle aria-label="Manque :" className="size-4" />
                  )}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </Field>
        <Field invalid={!!errors.code}>
          <FieldLabel>Code d'installation</FieldLabel>
          <Input
            type="password"
            autoComplete="off"
            className="min-h-11 text-base"
            {...register("code")}
          />
          <FieldDescription>
            C'est la valeur de ADMIN_SETUP_CODE sur le serveur.
          </FieldDescription>
          <FieldError match={!!errors.code}>
            Entre le code d'installation.
          </FieldError>
        </Field>
        <Problem message={problem} />
        <Button type="submit" size="lg" disabled={isSubmitting}>
          Créer le mot de passe
        </Button>
      </form>
    </Shell>
  );
}
