# Cahier des charges fonctionnel — Zbeul, the app for afterparties

> Inspiré de l'application mobile « BAZAR - Jeu entre potes ». Version web gratuite, non commerciale, installable sur l'écran d'accueil du téléphone et distribuée sur un site personnel, sans passer par les stores.
>
> Ce document décrit **ce que fait l'application**. Les choix techniques (architecture, base de données, bibliothèques, tests automatisés) seront décrits dans un document technique séparé.

---

## 1. Vue d'ensemble

Application web de jeux d'ambiance entre amis, jouée **sur un seul téléphone qu'on se passe**. Une partie **mélange tous les mini-jeux** (Tu préfères, J'ai déjà ou je n'ai jamais, Tribunal, culture G, Dans ma valise…). Le ton monte sur cinq niveaux, de **Apéro entre potes** à **Border**.

Principes :

- **Gratuit, sans compte, sans paiement, sans publicité.**
- **Toutes les données de jeu restent sur le téléphone** : rien sur les joueurs n'est envoyé en ligne.
- **Installable** sur l'écran d'accueil comme une application, et **jouable sans connexion** une fois chargée.
- **Mode gorgées désactivé par défaut**, activable en un geste. Sans gorgées, le jeu se joue aux points.
- Chaque carte affiche **son enjeu** (nombre de gorgées ou de points), **calculé par le jeu** selon l'intensité choisie et l'avancement de la partie.
  Seul l'administrateur se connecte, sur une page cachée, pour gérer les cartes.

## 2. Utilisateurs cibles

| Persona                            | Contexte                                    | Besoins clés                                                  |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Organisateur de soirée (18–30 ans) | Apéro, before, week-end entre potes         | Lancement en moins de 30 s, aucune inscription, contenu varié |
| Groupe étudiant                    | Soirées, grands groupes de 8 à 15 personnes | Équipes, gros boutons, jeu sans connexion                     |
| Groupe « nouveaux potes »          | Afterwork, colocs                           | Niveaux doux, brise-glace                                     |
| Administrateur                     | Toi                                         | Ajouter, modifier et publier des cartes rapidement            |

Le site est intégralement réservé aux personnes majeures.

## 3. Configuration d'une partie

Avant de lancer, l'organisateur règle :

0. **Langue** : FR (par défaut) ou EN, voir §12.
1. **Joueurs** : prénoms (2 à 20), dans n'importe quel ordre. Pour chaque joueur :
   - **genre** : gars / fille / autre. Sert à accorder les cartes (il / elle / iel) et aux cartes « Tous les gars boivent », « Toutes les filles boivent » et « Tous ceux qui ne sont ni gars ni fille boivent » ;
   - **profil** (plafond de niveau, voir §5) : **identique pour tous par défaut**, égal au niveau de la partie. On ne le modifie que pour les joueurs qui veulent un plafond différent ;
   - **exclusions par thème** (options avancées, voir §6).
2. **Format** : **Équipes** ou **Chacun pour soi**. En équipes :
   - **nombre d'équipes** au choix, de 2 jusqu'au nombre permettant au moins 2 joueurs par équipe (5 équipes maximum) ;
   - **composition** : « Aléatoire » (répartition équilibrée, relançable d'un bouton) ou « À la main » (chaque joueur est placé dans une équipe) ;
   - chaque équipe a un nom par défaut (Équipe 1, 2…) modifiable ;
   - le lancement est bloqué tant qu'une équipe a moins de 2 joueurs.
3. **Niveau** : plafond de la partie (Apéro entre potes → Border), avec l'option **« montée en pression »** (la partie démarre au niveau 1 et monte d'un cran toutes les N cartes).
4. **Mini-jeux** : liste de cases à cocher, **toutes cochées par défaut** (voir §4). Décocher un mini-jeu le retire de la partie.
5. **Gorgées** : interrupteur bien visible, **désactivé par défaut**. Activé, il affiche une fois le message « L'abus d'alcool est dangereux pour la santé ». Désactivé, toutes les gorgées deviennent des points.
6. **Intensité des gorgées** : Douce, Normale (par défaut), Forte ou Hardcore. Sans montée progressive, X reste dans 1 à 2, 1 à 3, 2 à 4 ou 3 à 5. Avec l'option **« montée progressive »**, activée par défaut : les petites valeurs sortent surtout en début de partie, les grosses en fin de partie (voir §4).
7. **Durée** : 30, 50, 80 cartes ou illimité.
8. **Packs** : packs officiels, tous gratuits.
   Les derniers réglages et les derniers joueurs sont mémorisés sur le téléphone et proposés à la partie suivante.

## 4. Mini-jeux (tous mélangés dans la partie)

Chaque carte appartient à **un mini-jeu** et à **un niveau**. Les cartes sont tirées en mélangeant tous les mini-jeux cochés.

**Règle d'enjeu commune** : les cartes ne portent pas de nombre de gorgées. Le texte dit « boit », « boivent » ou « boivent double », et le jeu affiche l'enjeu **X** au moment où la carte sort :

- **sans montée progressive** : X est tiré au hasard dans la plage de l'intensité choisie, chaque valeur sortant à peu près aussi souvent ;
- **avec montée progressive** : la plage monte au fil de la partie. En intensité Normale, X vaut surtout 1 ou 2 au début et atteint 4 ou 5 dans les dernières cartes ; Douce monte jusqu'à 3, Forte part de 2 et Hardcore de 3, toutes deux jusqu'à 5. En durée illimitée, la montée se fait sur 80 cartes puis reste au maximum ;
- X ne dépasse jamais 5, pour qu'un enjeu doublé reste dans la limite de 10 gorgées (§11) ;
- toutes les cartes d'une même partie suivent la même courbe, quel que soit leur mini-jeu.
- La personne qui **réussit** ou **gagne** **distribue** X gorgées à qui elle veut.
- La personne qui **échoue** ou **perd** **boit** X gorgées.
- En mode points : « Gagné » rapporte +X points et « Perdu » retire X points au joueur (ou à l'équipe) visé par la carte. Les cartes collectives ne comptent pas dans le score.
- En équipes : c'est l'équipe qui gagne ou perd ; l'équipe gagnante distribue, l'équipe perdante boit (chaque membre boit X) ou perd X points.
  | Mini-jeu | Principe | Joueurs | Phase | |---|---|---|---|
  | **Tu préfères** | Dilemme ; la minorité boit | 3+ | MVP |
  | **J'ai déjà ou je n'ai jamais** | Une phrase « J'ai déjà… » ou « Je n'ai jamais… » est lue à voix haute : écrite sur la carte, ou inventée par le joueur désigné ; ceux qui l'ont fait boivent | 3+ | MVP |
  | **Action ou vérité** | Le joueur choisit ; refuser = boire | 2+ | MVP |
  | **Qui pourrait… ?** | Vote en pointant du doigt ; le plus désigné boit | 3+ | MVP |
  | **Tribunal** | Un joueur est jugé ; le groupe vote coupable ou non coupable ; coupable = boit | 4+ | MVP |
  | **Duel** | Deux joueurs (ou deux équipes) s'affrontent sur un défi ; le groupe arbitre ; pas de boutons « Gagné » / « Perdu » : la carte affiche « Le perdant boit X gorgées » (ou « Le perdant perd X points ») | 3+ | MVP |
  | **Culture G : le plus proche** | Question à réponse chiffrée ; **4 joueurs tirés au sort** annoncent un nombre à voix haute ; **la bonne réponse s'affiche en haut de la carte suivante** ; le plus proche distribue, le plus éloigné boit | 4+ | MVP |
  | **Chaîne de thème** | Un thème est donné et la carte désigne qui commence (« Romain, tu commences ») ; chacun cite un élément à son tour ; le premier qui sèche ou répète boit | 3+ | MVP |
  | **Dans ma valise** | La carte désigne qui commence ; chacun répète la liste et ajoute un objet ; le premier qui se trompe boit | 3+ | MVP |
  | **Montre ou bois** | Défi à prouver sur-le-champ ; si le joueur ne peut pas, il boit | 2+ | MVP |
  | **Tout le monde concerné** | Distribution collective : « Tous les gars boivent », « Toutes les filles boivent », « Tous ceux qui ne sont ni gars ni fille boivent », « Ceux qui ont un ex dans la salle boivent » | 2+ | MVP |
  | **Sentence gratuite** | Un joueur tiré au sort boit sans raison particulière, avec une phrase de roast ; en mode points, il perd X points automatiquement, sans bouton | 2+ | MVP |
  | **Invente une règle** | Le joueur annonce une règle à voix haute, valable pendant N cartes ; le bandeau rappelle « Règle de Romain » jusqu'à expiration | 3+ | MVP |
  | **Partenaire de boisson** | Le joueur désigne un partenaire à voix haute ; jusqu'à la fin de la partie, dès que l'un boit, l'autre boit autant | 5+ | MVP |
  | **Pause** | Carte « pause / hydratation » : tout le monde boit un verre d'eau ; aucun enjeu | 2+ | MVP |
  | **Paranoïa** | Question montrée en secret à un joueur, qui nomme quelqu'un ; la personne désignée peut boire 5 gorgées pour révéler la question (en mode sans gorgées : pile ou face) | 3+ | V1 |

**Exemples de cartes « chaîne de thème »** : marques de voiture, moyens de contraception, inégalités entre hommes et femmes (salaire, tâches ménagères…), pays d'Afrique, joueurs de foot.

**Exemples de questions « culture G »** : nombre d'étoiles dans la Voie lactée, taille à partir de laquelle on est considéré comme atteint de nanisme. Chaque question a une réponse, une unité et une **source vérifiée** : une question sans chiffre sourcé n'est pas publiée.

**Règles particulières** :

- **Partenaire de boisson** : 1 carte par tranche de 5 joueurs (1 dès 5 joueurs, 2 dès 10, etc.), aucune en dessous de 5. Une carte déjà jouée peut revenir quand le paquet n'en a plus d'autre. Un joueur ne peut tirer cette carte qu'une fois. Le bandeau rappelle en permanence « Romain a un partenaire de boisson ». Carte retirée si les gorgées sont désactivées.
- **Ordre de jeu libre** : pour les jeux à tour de rôle, la carte indique seulement qui commence. Le sens, l'ordre et le droit de passer son tour sont laissés au groupe ; l'écran ne change pas pendant le tour et affiche « Les perdants boivent X gorgées ».
- **Cartes de genre** (gars / filles / autres) : **réservées au mode gorgées** (sans effet sur le score, elles sont retirées en mode points). En mode gorgées, **les trois cartes tombent à chaque partie**, par équité, à des moments aléatoires. Une carte est sautée si aucun joueur de la partie n'est concerné.
- **Pause** : mini-jeu de la famille Collectif et règles, **réservé au mode gorgées**, **impossible à décocher** (il n'apparaît pas dans la liste des mini-jeux), environ une carte toutes les 50 cartes.
- **Cartes collectives et profils** : une carte qui concerne tout le groupe (J'ai déjà ou je n'ai jamais, Qui pourrait, Tu préfères, Tout le monde concerné…) n'est tirée que si son niveau est **inférieur ou égal au plus petit plafond des joueurs présents**. Un joueur Tranquille ne subit donc jamais une carte collective Border.
- **Duel en mode points** : le perdant étant désigné à voix haute, le Duel ne modifie pas le score affiché, comme les cartes collectives.
- **Double palier** (Tout le monde concerné) : la carte vise deux groupes, par exemple « Ceux qui ont déjà dansé sur une table boivent. Ceux qui en sont tombés boivent double. » Le premier groupe boit X, le second boit 2 × X. L'écran affiche les deux enjeux : « 2 gorgées, 4 pour le second groupe ». Comme les autres cartes collectives, elle ne modifie pas le score en mode points.
- **Témoin** (Action ou vérité) : la carte vise un joueur, mais un autre joueur présent peut être concerné (« Si quelqu'un ici t'a tenu les cheveux, vous buvez tous les deux »). Le témoin se désigne à voix haute ; il raconte à la place du joueur, confirme ou dément, ou boit le même enjeu X. L'écran ne propose aucun choix de joueur : en mode points, seuls « Gagné » / « Perdu » du joueur visé comptent, la part du témoin ne modifie pas le score.
- **Règles inventées** : une règle expire après 10 cartes par défaut ; 3 règles actives au maximum.
- En **équipes**, les cartes individuelles (vérité, montre ou bois…) restent individuelles, mais l'enjeu compte pour l'équipe du joueur.

## 5. Niveaux

La partie a un **niveau plafond**, et chaque joueur a **son propre plafond**. Une carte ne vise jamais un joueur dont le plafond est inférieur au niveau de la carte, et une carte collective ne dépasse jamais le plus petit plafond des joueurs présents (voir §4).

**Le niveau choisi domine la partie** : les cartes sont tirées dans tous les niveaux jusqu'au plafond, mais plus un niveau est proche du plafond, plus ses cartes sont fréquentes. Le poids d'un niveau double à chaque cran (1, 2, 4, 8, 16), pour que le niveau choisi fasse environ la moitié des cartes (retours des premiers joueurs, `docs/specs/play-feedback.md`) :

| Plafond de la partie  | Niv. 1 | Niv. 2 | Niv. 3 | Niv. 4 | Niv. 5 |
| --------------------- | ------ | ------ | ------ | ------ | ------ |
| 5 · Border            | 3 %    | 6 %    | 13 %   | 26 %   | 52 %   |
| 4 · Sans filtre       | 7 %    | 13 %   | 27 %   | 53 %   | —      |
| 3 · Piquant           | 14 %   | 29 %   | 57 %   | —      | —      |
| 2 · Festif            | 33 %   | 67 %   | —      | —      | —      |
| 1 · Apéro entre potes | 100 %  | —      | —      | —      | —      |

- avec la **montée en pression**, la partie monte d'un cran à intervalles réguliers et atteint son niveau **à la moitié de la partie** ; la même répartition s'applique au niveau atteint à ce moment ;
- les cartes collectives limitées par un joueur au profil plus bas réduisent un peu cette répartition : c'est voulu, le confort de chacun passe avant le niveau.
  | Niv. | Nom | Ton | Exemples | |---|---|---|---|
  | 1 | **Apéro entre potes** | Facile, brise-glace | « Quel est ton super pouvoir ? Montre-le ; si tu ne peux pas, bois. », Dans ma valise, culture G |
  | 2 | **Festif** | Taquin, absurde | Imitations, chaînes de thème, Tu préfères absurdes, Qui pourrait sur les manies du groupe |
  | 3 | **Piquant** | Flirt, révélations | Ex et crushs, chaîne « moyens de contraception », J'ai déjà ou je n'ai jamais plus osés |
  | 4 | **Sans filtre** | Cash, roast assumé | Tribunal, vérités qui dérangent, avis cash sur le groupe |
  | 5 | **Border** | Limite limite, tabou, malaise assumé | « Donne ton bodycount. », « Donne des raisons catastrophiques de quitter son/sa copine. », « Tu bois parce que t'es une merde, c'est tout. » |

**Thèmes du niveau Border** :

| Thème                  | Exemples                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Argent                 | « Combien tu gagnes par mois, sans arrondir ? »                                                                  |
| Avis sur le groupe     | « Qui ici tu n'inviterais pas à ton mariage ? », « Qui est le plus surcoté du groupe ? »                         |
| Couple et jalousie     | « As-tu déjà fouillé le téléphone de ton/ta partenaire ? », « Raisons catastrophiques de quitter son/sa copine » |
| Intimité               | « Donne ton bodycount. », « Ton pire moment gênant au lit, sans détails ? »                                      |
| Trahisons et secrets   | « Le pire truc que tu as dit dans le dos de quelqu'un ici ? »                                                    |
| Transgressions passées | « La chose la plus illégale que tu as faite sans te faire prendre ? »                                            |
| Roast gratuit          | « Tu bois parce que t'es une merde, c'est tout. »                                                                |

Le niveau **Border** nécessite une **confirmation globale unique** à son activation : la personne qui configure confirme que tous les joueurs sont majeurs et d'accord. Un joueur qui ne veut pas de Border baisse simplement son profil (plafond personnel).

**Profils joueur** (par défaut, chaque joueur a le plafond de la partie ; on ne change que ceux qui diffèrent) :

| Profil     | Plafond |
| ---------- | ------- |
| Tranquille | 2       |
| Partant    | 3       |
| Chaud      | 4       |
| Border     | 5       |

**Règles éditoriales transverses (tous niveaux, Border compris)** :

- le malaise vient de **la question posée à quelqu'un de présent**, jamais d'une attaque sur une origine, une couleur de peau, une religion, une orientation, un handicap ou un physique ;
- aucun contenu pornographique ni description d'acte sexuel explicite ;
- aucune nudité imposée, aucun contact physique non consenti ;
- aucune mise en danger (conduite, ingestion de produits, défis physiques risqués) ;
- aucune incitation à filmer, photographier ou diffuser qui que ce soit ;
- **aucune carte basée sur le téléphone des joueurs** : pas d'appel ni de message à un contact, pas de dernière photo, dernier message ou dernière recherche à montrer, pas de consultation des abonnements ou abonnés sur les réseaux sociaux ;
- **joker** (mode points) sans justification : le joueur perd X points et reçoit une autre carte du même mini-jeu, sans joker cette fois. En mode gorgées il n'y a pas de bouton : on passe à la carte suivante.

## 6. Thèmes de contenu (exclusions)

Dans les options avancées de chaque joueur, ou pour toute la partie, on peut exclure :

- contact physique ;
- sexualité ;
- ex ;
- couple et jalousie ;
- argent ;
- avis sur le groupe ;
- secrets ;
- transgressions passées.

## 7. Déroulé d'une partie

1. **Porte d'âge** à la première visite (voir §11).
2. **Accueil** minimaliste (voir §14) : « Jouer » ; si une partie en cours existe, « Reprendre la partie » / « Nouvelle partie ».
3. **Configuration** (§3).
4. **Tour de jeu** :
   - carte **en plein écran, en mode paysage** (voir §12) : famille de mini-jeu, couleur du niveau, prénoms des joueurs **surlignés** (voir §13), **enjeu affiché** (« Les perdants boivent X gorgées » ou « Les perdants perdent X points », X calculé par le jeu) ;
   - **actions minimales** (révisées après les premiers retours, `docs/specs/play-feedback.md`) :
     - **mode gorgées** : uniquement « Carte suivante ». La carte dit qui boit ; rien n'est compté ;
     - **mode points** : « Gagné » / « Perdu » / « Joker » quand un seul joueur est visé ; pour une carte collective, un duel ou une culture G, les prénoms s'affichent et on touche ceux qui perdent (ou gagnent) ; ne toucher personne est permis ;
     - **Action ou vérité** : le joueur choisit d'abord, la moitié choisie s'affiche ensuite ;
     - **Culture G** : la réponse a sa propre carte, avec la question, l'enjeu et la source ;
     - aucune saisie de nombre ni de phrase : tout se dit à voix haute ;
   - bandeau permanent : règles actives et partenaires de boisson ; une règle qui se termine est annoncée ;
   - **retour en arrière** : un bouton revient à la carte précédente (score compris), jusqu'à 20 appuis ;
   - **pouce levé / pouce baissé** sur chaque carte : le pouce levé garde la carte en favori et envoie un « j'aime » anonyme ; le pouce baissé ouvre les raisons à cocher (nulle ou ennuyeuse, trop longue, trop dure, à modifier) et un message facultatif. Un second appui annule. Les votes de tous les joueurs font sortir une carte plus ou moins tôt (chances de ×0,25 à ×2), sans jamais la retirer ;
   - la croix propose : continuer, **mettre en pause** (retour à l'accueil) ou terminer.
5. **Fin** : classement (joueurs ou équipes) en mode points seulement, pouce levé sur les meilleures cartes, « Rejouer ».
   **Tirage des cartes** :

- seules sont tirées les cartes : des mini-jeux cochés, d'un niveau compatible avec la partie et avec les joueurs visés (pour une carte collective : avec tous les joueurs présents), hors thèmes exclus, jouables avec le nombre de joueurs présents ;
- **répartition par niveau** : les niveaux proches du plafond sortent plus souvent (voir §5) ;
- les cartes réservées au mode gorgées (partenaire de boisson, cartes de genre, pauses) sont retirées si les gorgées sont désactivées ;
- en mode gorgées, une carte Pause est insérée environ toutes les 50 cartes ;
- en mode gorgées, les trois cartes de genre tombent à des moments aléatoires, et une carte est sautée si personne n'est concerné ;
- **mélange équilibré** : le jeu choisit d'abord un mini-jeu parmi ceux cochés, puis une carte de ce mini-jeu. Chaque mini-jeu a la même chance de sortir, quel que soit son nombre de cartes. Jamais deux cartes du même mini-jeu d'affilée, et pas plus d'une culture G toutes les 5 cartes ;
- quotas : partenaire de boisson limité selon le nombre de joueurs, 3 règles actives au maximum ;
- **pas de répétition** : les cartes vues lors des dernières parties sur ce téléphone ne reviennent pas tout de suite ;
- tous les joueurs sont visés à peu près aussi souvent.
  **Sauvegarde et reprise** :

- la partie est sauvegardée automatiquement sur le téléphone à chaque action ;
- une partie de moins de 12 h est proposée à la reprise ;
- aucune partie n'est perdue après un rechargement, un appel, un passage dans une autre application ou une perte de connexion.

## 8. Contenu d'une carte

| Information            | Description                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Mini-jeu               | L'un des mini-jeux du §4                                                                                          |
| Niveau                 | 1 à 5 (5 = Border)                                                                                                |
| Texte                  | Avec emplacements pour les prénoms des joueurs visés, un joueur au hasard, un nombre, et l'accord il / elle / iel |
| Enjeu                  | Aucun nombre stocké : le texte dit « boit », « boivent » ou « boivent double », et le jeu calcule X (§3 et §4)    |
| Second groupe          | Pour le double palier : le second groupe boit le double de l'enjeu                                                |
| Témoin                 | Carte qui peut faire parler ou boire un témoin désigné à voix haute                                               |
| Public                 | Joueurs tirés au sort, tout le monde, les gars, les filles, ou les autres                                         |
| Joueurs visés          | Nombre de joueurs désignés (4 pour la culture G)                                                                  |
| Joueurs minimum        | Nombre minimum de joueurs dans la partie                                                                          |
| Gorgées uniquement     | Carte jouable seulement si les gorgées sont activées (ex. partenaire de boisson)                                  |
| Thèmes                 | Thèmes de contenu du §6                                                                                           |
| Réponse, unité, source | Pour la culture G                                                                                                 |
| Durée de la règle      | Pour « Invente une règle » : nombre de cartes de validité                                                         |
| Langue                 | FR, EN                                                                                                            |
| Statut                 | Brouillon, publiée, archivée                                                                                      |

## 9. Données gardées sur le téléphone

Jamais envoyées en ligne :

- partie en cours (réglages, joueurs, équipes, scores, règles actives, partenaires de boisson, réponse de culture G à afficher, cartes restantes et jouées) ;
- favoris ;
- derniers réglages de partie et derniers joueurs ;
- cartes vues récemment (pour éviter les répétitions) ;
- langue et thème choisis.
  Après une mise à jour de l'application, une partie sauvegardée avec une ancienne version doit rester récupérable.

La page Réglages permet d'**effacer toutes les données du téléphone**.

## 10. Administration

- Page **`/admin` cachée** : aucun lien, menu ni bouton vers elle sur le site public.
- Connexion par **compte Google ou lien magique reçu par e-mail**, réservée à une liste d'adresses autorisées.
- Fonctionnalités :
  - créer, modifier, archiver des cartes et leurs traductions, avec des champs adaptés au mini-jeu (réponse et source pour la culture G, durée pour les règles) ;
  - prévisualiser une carte avec plusieurs enjeux (début et fin de partie, intensités) ;
  - prévisualiser une carte avec des prénoms fictifs ;
  - créer et modifier les packs officiels ;
  - modifier plusieurs cartes à la fois (niveau, thèmes, statut) ;
  - traiter les signalements (corriger, archiver la carte, classer sans suite) ;
  - consulter l'historique des modifications (qui a modifié quoi, et quand).
    **Sécurité de l'admin** :

- une page cachée n'est pas une protection : chaque page et chaque action de l'admin vérifie que la personne est connectée **et** autorisée ;
- une personne connectée mais non autorisée voit une page « introuvable », pour ne pas révéler l'existence de l'admin ;
- l'admin n'est pas indexé par les moteurs de recherche et n'est jamais disponible hors connexion ;
- les demandes de lien magique sont limitées pour éviter les abus.
  **Données en ligne** (uniquement le contenu du jeu et l'administration) : comptes administrateurs, niveaux, cartes et traductions, packs, signalements, historique des modifications.

## 11. Âge et cadre légal

| Sujet            | Exigence                                                                                                                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Porte d'âge      | Écran « Ce site est réservé aux personnes majeures », bouton « J'ai 18 ans ou plus », lien de sortie, mémorisé 12 mois sur le téléphone. Confirmation globale à l'activation de Border                                                                                                         |
| Alcool           | Gorgées **désactivées par défaut** ; activation volontaire avec message « L'abus d'alcool est dangereux pour la santé » ; aucune marque ni visuel de bouteille ; enjeu maximum de 10 gorgées par carte ; cartes « Pause » (hydratation) environ toutes les 50 cartes, impossibles à désactiver |
| Contenus         | Ligne éditoriale du §5 : pas de pornographie (loi SREN), pas de contenu visant une origine ou une couleur de peau (provocation à la haine, diffamation et injure raciales punies par la loi de 1881)                                                                                           |
| RGPD             | Aucune donnée joueur envoyée en ligne. Signalement anonyme. Page de confidentialité qui l'explique                                                                                                                                                                                             |
| Mentions légales | Identité de l'hébergeur et de l'éditeur (en tant que particulier, coordonnées transmissibles à l'hébergeur)                                                                                                                                                                                    |
| Pages            | Mentions légales, conditions d'utilisation, confidentialité, charte de contenu                                                                                                                                                                                                                 |

## 12. Exigences d'usage

**Pensée pour le téléphone, sur toutes les tailles d'écran**

- s'adapte à tous les téléphones, du plus petit (iPhone SE) aux grands modèles, en portrait comme en paysage ;
- le texte d'une carte tient toujours à l'écran sans défilement, même pour une carte longue (taille du texte ajustée automatiquement) ;
- rien n'est masqué par l'encoche ou la caméra frontale, y compris en paysage ;
- gros boutons faciles à toucher, surtout sur l'écran de jeu ;
- sur tablette et ordinateur : contenu centré, utilisable sans être optimisé ;
- l'écran ne se met pas en veille pendant une partie.
  **Écran de jeu en paysage plein écran**

- l'écran de jeu est conçu pour le **paysage** : carte au centre, boutons « Gagné » / « Perdu » / « Joker » sur les côtés, à portée des pouces ;
- sur Android, la partie passe automatiquement en plein écran et en paysage ;
- sur iPhone, le navigateur ne le permet pas : une fois l'application installée, les barres du navigateur disparaissent, et un message « Tourne ton téléphone » s'affiche en portrait ;
- ce message peut être fermé : en portrait, la carte reste lisible avec une mise en page adaptée ;
- les autres écrans (accueil, configuration, réglages, admin) s'affichent normalement en portrait.
  **Installation et jeu sans connexion**

- l'application s'installe sur l'écran d'accueil comme une vraie appli ;
- une page d'aide explique l'installation sur Android et sur iPhone (sur iPhone : « Partager » puis « Sur l'écran d'accueil ») ;
- une fois chargée, une partie est entièrement jouable sans connexion, avec toutes les cartes ;
- une mise à jour de l'application ne s'applique jamais pendant une partie, seulement au retour à l'accueil ;
- l'installation est recommandée sur iPhone, car elle protège mieux les données gardées sur le téléphone.
  **Langues**

- **choix de la langue FR / EN** dans la configuration et dans Réglages, **français par défaut**, même si le téléphone est en anglais ;
- le choix est mémorisé ;
- le français est la langue de référence ; le choix de langue n'apparaît qu'une fois les cartes anglaises disponibles (V1) ;
- une carte non traduite n'apparaît pas dans l'autre langue.
  **Accessibilité**

- contrastes suffisants dans tous les thèmes ;
- les lecteurs d'écran annoncent chaque nouvelle carte ;
- les couleurs (niveaux, familles) sont toujours accompagnées d'un libellé ;
- les animations sont réduites pour les personnes qui l'ont demandé dans les réglages de leur téléphone.
  **Rapidité**

- l'accueil s'affiche en moins de 2 secondes en 4G sur un téléphone milieu de gamme ;
- le passage d'une carte à l'autre est instantané, même sans connexion.

## 13. Identité visuelle

Direction visuelle. Nom du jeu : **Zbeul**, avec l'accroche « Zbeul, the app for afterparties ». C'est aussi le nom affiché sous l'icône une fois l'application installée. Le logo, l'icône définitive et la palette précise restent à fixer.

**Thèmes**

- **thème sombre par défaut** : on joue en soirée, souvent dans la pénombre ;
- thèmes au choix dans Réglages :
  | Thème | Type | Ambiance | |---|---|---|
  | **Nuit** (défaut) | Sombre | Fond quasi noir, accents vifs |
  | **Tokyo Night** | Sombre | Bleus nuit, violets et cyans désaturés |
  | **Rétro** | Sombre | Esprit années 80, néons rose et orange sur fond violet profond |
  | **Clair** | Clair | Fond blanc cassé, accents saturés |
  | **Crème** | Clair | Tons chauds et papier, contraste doux |

- **aperçu immédiat** : dans Réglages, toucher un thème l'applique tout de suite à l'écran, avec une **carte d'exemple** (couleur de niveau, badge de famille, prénom surligné) pour voir si ça plaît ; on peut passer d'un thème à l'autre librement ;
- le thème choisi reste actif aux visites suivantes, sans flash d'un autre thème au chargement ;
- chaque thème décline les couleurs de niveau et de famille en gardant une bonne lisibilité.
  **Couleur par niveau**

La couleur du niveau donne le fond de la carte, pour rendre la montée en pression visible d'un coup d'œil.

| Niveau                | Intention          | Teinte indicative (thème Nuit) |
| --------------------- | ------------------ | ------------------------------ |
| 1 · Apéro entre potes | Calme, accueillant | Vert menthe                    |
| 2 · Festif            | Joyeux             | Jaune soleil                   |
| 3 · Piquant           | Ça chauffe         | Orange                         |
| 4 · Sans filtre       | Intense            | Rouge framboise                |
| 5 · Border            | Limite             | Violet profond, liseré néon    |

**Couleur par famille de mini-jeux**

La famille est affichée en badge en haut de la carte, toujours avec son libellé.

| Famille                 | Mini-jeux                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **Vote**                | Tu préfères, Qui pourrait, Tribunal, Paranoïa                                       |
| **Révélations**         | J'ai déjà ou je n'ai jamais, Action ou vérité                                       |
| **Défis**               | Duel, Montre ou bois, Chaîne de thème, Dans ma valise                               |
| **Culture G**           | Le plus proche                                                                      |
| **Collectif et règles** | Tout le monde concerné, Sentence gratuite, Invente une règle, Partenaire de boisson |

**Prénoms surlignés**

- sur chaque carte, les prénoms des joueurs cités sont **surlignés** (fond d'accent, texte en gras, coins arrondis) pour être repérés immédiatement ;
- le surlignage reste lisible sur toutes les couleurs de niveau.
  **Typographie**

- une police d'affichage très lisible et grasse pour le texte des cartes ;
- une police sobre pour l'interface (réglages, configuration, admin) ;
- les polices fonctionnent aussi sans connexion.
  **Ton des textes**

- tutoiement partout ;
- phrases courtes ;
- humour, y compris dans les boutons, les messages vides et les erreurs (« Plus de cartes ? Vous êtes des machines. ») ;
- les messages légaux (âge, alcool) restent clairs, dans le même ton mais sans blague sur leur contenu.
  **Animations**

Légères, rapides, jamais bloquantes : elles rendent l'appli vivante et plus pro sans ralentir la partie.

- **changement de carte** : la carte sort et la suivante entre en glissant ou en se retournant (moins d'un tiers de seconde) ;
- **boutons** : léger rebond à l'appui ;
- **montée de niveau** : changement doux de la couleur de fond et petit badge « Niveau 3 · Piquant » ;
- **prénoms surlignés** : le surlignage apparaît juste après la carte ;
- **fin de partie** : classement qui apparaît ligne par ligne, petite célébration pour le gagnant ;
- fluides même sur un téléphone milieu de gamme ;
- remplacées par un simple fondu pour les personnes qui ont demandé moins d'animations.

## 14. Navigation et écrans

**Principes** (application pensée avant tout pour le téléphone) :

- **aucun menu déroulant, aucun menu burger, aucune barre de navigation** ;
- **accueil minimaliste**, avec seulement l'essentiel :
  - gros bouton **« Jouer »** (ou **« Reprendre la partie »** / **« Nouvelle partie »** si une partie est en cours) ;
  - bouton **« Installer l'appli »**, masqué quand l'application est déjà installée ;
  - deux liens discrets en bas : **« Favoris »** et **« Réglages »** ;
- tout le secondaire est rangé dans **Réglages** : langue, thème, effacement des données, « Signaler un problème », pages légales, version de l'app ;
- chaque écran secondaire a un simple bouton « Retour » ; le geste retour du téléphone fonctionne partout ;
- le seul signalement accessible hors Réglages est le pouce baissé sur l'écran de jeu.
  | Écran | Rôle | Accès | |---|---|---|
  | Porte d'âge | Confirmation de majorité | Première visite |
  | Accueil | Jouer, reprendre, installer | Point d'entrée |
  | Configuration | Réglages de la partie (§3) | Bouton « Jouer » |
  | Jeu | Cartes en plein écran | Fin de la configuration |
  | Fin de partie | Classement, favoris, rejouer | Fin de partie |
  | Installer l'appli | Guide d'installation Android et iPhone | Bouton de l'accueil |
  | Favoris | Cartes mises de côté | Lien discret de l'accueil |
  | Réglages | Langue, thème avec aperçu, effacement des données, liens secondaires | Lien discret de l'accueil |
  | Signaler un problème | Texte libre, carte facultative, anonyme | Lien dans Réglages |
  | Pages légales | Mentions légales, conditions d'utilisation, confidentialité, charte de contenu | Liens dans Réglages et sur la porte d'âge |
  | Admin (caché) | Tableau de bord, cartes, packs, signalements | Adresse `/admin` uniquement |
  | Connexion admin | Google ou lien magique | Depuis `/admin` |

## 15. Critères d'acceptation

- **Porte d'âge** : affichée à la première visite, puis plus pendant 12 mois après acceptation.
- **Gorgées** : désactivées par défaut ; le message de prévention s'affiche à l'activation.
- **Partie mixte** : plusieurs mini-jeux différents apparaissent, jamais deux fois le même d'affilée ; un mini-jeu décoché n'apparaît jamais.
- **Mélange équilibré** : sur un grand nombre de parties, chaque mini-jeu coché sort à peu près aussi souvent que les autres, quel que soit son nombre de cartes ; jamais plus d'une culture G sur 5 cartes consécutives.
- **Enjeu** : en intensité Normale avec montée progressive, les 10 premières cartes affichent surtout 1 ou 2 gorgées et les 10 dernières surtout 4 ou 5 ; sans montée progressive, 1, 2 et 3 sortent à peu près aussi souvent ; X ne dépasse jamais 5 ; des points s'affichent quand les gorgées sont désactivées.
- **Double palier** : une carte à 2 affiche « 2 gorgées, 4 pour le second groupe » ; aucun score ne change en mode points.
- **Témoin** : aucune sélection de joueur à l'écran ; en mode points, seul le joueur visé gagne ou perd des points.
- **Culture G** : 4 joueurs désignés, aucune saisie, la réponse s'affiche en haut de la carte suivante.
- **Écran de jeu** : aucun champ de saisie ni choix de joueurs, au plus « Gagné », « Perdu », « Joker » et « Carte suivante ».
- **Paysage** : carte et boutons visibles sans défilement ; en portrait, message « Tourne ton téléphone » refermable.
- **Toutes tailles** : sur le plus petit comme sur le plus grand téléphone, pas de défilement horizontal, et la carte la plus longue reste lisible sans défilement.
- **Identité visuelle** : thème Nuit par défaut ; dans Réglages, toucher un thème l'applique immédiatement avec la carte d'exemple, et le choix reste actif à la visite suivante ; prénoms cités surlignés ; animations réduites si demandé.
- **Accueil** : seulement « Jouer » (ou « Reprendre »), « Installer l'appli », « Favoris » et « Réglages » ; bouton d'installation absent une fois l'app installée ; aucun menu.
- **Langue** : français par défaut même avec un téléphone en anglais ; le passage en EN est mémorisé.
- **Partenaire de boisson** : absent sans gorgées ou à moins de 5 joueurs, une fois par tranche de 5 joueurs.
- **Cartes de genre** : absentes en mode points ; en mode gorgées, les trois tombent dans chaque partie ; une carte est sautée si personne n'est concerné.
- **Pause** : absente de la liste des mini-jeux ; en mode gorgées, environ une carte toutes les 50 ; absente en mode points.
- **Cartes collectives** : avec un joueur Tranquille dans la partie, aucune carte collective de niveau 3 ou plus n'apparaît.
- **Répartition par niveau** : sur une partie Border, les cartes de niveau 5 sont les plus fréquentes, puis celles de niveau 4, et ainsi de suite.
- **Duel** : pas de boutons « Gagné » / « Perdu », la carte affiche « Le perdant boit X gorgées ».
- **Sentence gratuite** : en mode points, le joueur visé perd X points sans action.
- **Profil** : un joueur sans plafond personnalisé suit le niveau de la partie.
- **Équipes** : 3 équipes réparties au hasard puis modifiées à la main ; lancement bloqué si une équipe a moins de 2 joueurs ; score par équipe mis à jour.
- **Border** : une seule confirmation à l'activation ; aucune carte Border pour un joueur au profil plus bas.
- **Reprise** : après 5 cartes et un rechargement, la partie reprend à la 6e.
- **Sans connexion** : une partie complète se joue en mode avion.
- **Admin** : connexion obligatoire, page introuvable pour une personne non autorisée, aucune action possible sans droits, aucun lien vers l'admin sur le site public.

## 16. Priorisation

| Phase         | Périmètre                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP**       | Porte d'âge ; configuration complète (équipes ou chacun pour soi, mini-jeux à cocher, gorgées désactivées par défaut, intensité et montée progressive des gorgées) ; partie mixte avec tous les mini-jeux sauf Paranoïa ; enjeu affiché par carte ; 5 niveaux avec confirmation globale pour Border ; environ 750 cartes FR : par niveau, au moins 10 cartes par mini-jeu (culture G comprise, questions sourcées) et environ 150 cartes au total ; sauvegarde et reprise ; favoris ; installation et jeu sans connexion ; thèmes ; admin caché ; signalement ; pages légales |
| **V1**        | Paranoïa ; statistiques de cartes (fréquence de sortie par mini-jeu et par carte, cartes les plus signalées) ; version anglaise                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Plus tard** | Packs thématiques (couple, EVJF/EVG, vacances) ; jeu sur plusieurs téléphones ; autres langues                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## 17. Hors périmètre

- comptes joueurs et synchronisation entre appareils ;
- paiement, Premium, publicité ;
- packs personnels et cartes créées par les joueurs ;
- import / export de données ;
- notifications ;
- publication sur l'App Store ou Google Play.
