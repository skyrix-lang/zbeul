import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Screen } from "../components/screen";
import { LEGAL_LINKS, PATHS } from "../paths";

// The four legal pages. Clear, in the app's voice, and without jokes about
// what they say. They are readable before the age gate.

/**
 * Who hosts the site. Required by French law (LCEN, art. 6 III): fill it in
 * before the site goes online. The publisher is a private person, whose
 * details are known to the host rather than published.
 */
const HOST = {
  name: "À compléter avant la mise en ligne",
  address: "À compléter avant la mise en ligne",
  contact: "À compléter avant la mise en ligne",
};

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

const list = "flex list-disc flex-col gap-1 pl-5";

const PAGES = {
  legal: {
    title: "Mentions légales",
    body: (
      <>
        <Block title="Éditeur">
          <p>
            Zbeul est édité par un particulier, à titre non professionnel et
            sans but commercial. Comme la loi le permet, son identité n'est pas
            publiée : ses coordonnées ont été transmises à l'hébergeur.
          </p>
        </Block>
        <Block title="Hébergeur">
          <p>
            {HOST.name}
            <br />
            {HOST.address}
            <br />
            {HOST.contact}
          </p>
        </Block>
        <Block title="Contact">
          <p>
            Une question, un contenu à faire retirer ? Passe par{" "}
            <Link to={PATHS.report} className="underline underline-offset-4">
              Signaler un problème
            </Link>
            .
          </p>
        </Block>
        <Block title="Propriété">
          <p>
            Le nom, les textes des cartes et l'interface de Zbeul appartiennent
            à leur auteur. Tu peux jouer autant que tu veux, pas les copier pour
            les revendre.
          </p>
        </Block>
      </>
    ),
  },
  terms: {
    title: "Conditions d'utilisation",
    body: (
      <>
        <Block title="Pour qui">
          <p>
            Zbeul est réservé aux personnes majeures. En confirmant ton âge à
            l'entrée, tu déclares avoir 18 ans ou plus.
          </p>
        </Block>
        <Block title="Ce que c'est">
          <p>
            Un jeu de soirée gratuit, sans compte, sans paiement et sans
            publicité. Il est fourni tel quel, sans garantie : il peut changer
            ou s'arrêter.
          </p>
        </Block>
        <Block title="Alcool">
          <p>
            Le mode gorgées est désactivé par défaut, et rien n'oblige à
            l'activer : le jeu se joue aux points. L'abus d'alcool est dangereux
            pour la santé. Personne ne doit être poussé à boire, et personne ne
            conduit après avoir bu.
          </p>
        </Block>
        <Block title="Entre vous">
          <ul className={list}>
            <li>Tout le monde joue de son plein gré, et peut arrêter.</li>
            <li>
              Le joker est toujours disponible, sans avoir à se justifier.
            </li>
            <li>
              Chacun peut baisser son profil ou retirer des thèmes dans ses
              options.
            </li>
            <li>
              Tu restes responsable de ce que tu dis et de ce que tu fais
              pendant une partie.
            </li>
          </ul>
        </Block>
      </>
    ),
  },
  privacy: {
    title: "Confidentialité",
    body: (
      <>
        <Block title="En bref">
          <p>
            Rien sur les joueurs n'est envoyé en ligne. Pas de compte, pas de
            publicité, pas de traceur, pas de cookie de suivi.
          </p>
        </Block>
        <Block title="Ce qui reste sur ton téléphone">
          <ul className={list}>
            <li>la partie en cours : joueurs, réglages, scores ;</li>
            <li>les derniers joueurs et réglages, pour relancer plus vite ;</li>
            <li>tes favoris et les cartes vues récemment ;</li>
            <li>le thème choisi, et la confirmation de ton âge.</li>
          </ul>
          <p>
            Ces données ne quittent jamais l'appareil. Tu peux tout effacer
            depuis les{" "}
            <Link to={PATHS.settings} className="underline underline-offset-4">
              Réglages
            </Link>
            .
          </p>
        </Block>
        <Block title="Ce qui part en ligne">
          <p>
            Uniquement un signalement, si tu en envoies un : ton texte et, le
            cas échéant, la référence de la carte. Il est anonyme : ni nom, ni
            adresse e-mail, ni contenu de ta partie. Ton adresse IP sert un
            court instant à limiter les abus, elle n'est pas enregistrée avec le
            signalement.
          </p>
        </Block>
        <Block title="Tes droits">
          <p>
            Comme aucune donnée personnelle n'est collectée, il n'y a rien à
            demander, corriger ou supprimer chez nous. Tout est chez toi.
          </p>
        </Block>
      </>
    ),
  },
  charter: {
    title: "Charte de contenu",
    body: (
      <>
        <Block title="L'esprit">
          <p>
            Le malaise vient de la question posée à quelqu'un de présent, jamais
            d'une attaque contre ce qu'il est.
          </p>
        </Block>
        <Block title="Ce que tu ne trouveras dans aucune carte">
          <ul className={list}>
            <li>
              une attaque sur une origine, une couleur de peau, une religion,
              une orientation, un handicap ou un physique ;
            </li>
            <li>de la pornographie ou la description d'un acte sexuel ;</li>
            <li>une nudité imposée ou un contact physique non consenti ;</li>
            <li>
              une mise en danger : conduite, produits à avaler, défis physiques
              risqués ;
            </li>
            <li>
              une incitation à filmer, photographier ou diffuser quelqu'un ;
            </li>
            <li>
              un défi sur le téléphone d'un joueur : ni appel, ni message, ni
              photo ou recherche à montrer.
            </li>
          </ul>
        </Block>
        <Block title="Toujours possible">
          <ul className={list}>
            <li>le joker, à tout moment, sans se justifier ;</li>
            <li>un profil plus tranquille pour un joueur ;</li>
            <li>des thèmes retirés, pour un joueur ou pour tout le monde.</li>
          </ul>
        </Block>
        <Block title="Une carte dépasse ?">
          <p>
            Signale-la avec le drapeau pendant la partie, ou depuis{" "}
            <Link to={PATHS.report} className="underline underline-offset-4">
              Signaler un problème
            </Link>
            .
          </p>
        </Block>
      </>
    ),
  },
} as const;

export type LegalPageId = keyof typeof PAGES;

export function LegalPage({ page }: { page: LegalPageId }) {
  const { title, body } = PAGES[page];
  return (
    <Screen title={title}>
      {body}
      <nav
        aria-label="Informations légales"
        className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-sm"
      >
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="text-muted-foreground py-2 underline underline-offset-4"
            activeProps={{ className: "text-foreground font-semibold" }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </Screen>
  );
}
