# Handoff : Refonte visuelle « Forêt » — FindYourJob

## Vue d'ensemble
Refonte complète de l'identité visuelle du site FindYourJob (orientation / reconversion).
On passe de la direction **indigo + emoji + Arial/Geist** à une direction éditoriale **« Forêt »** :
serif éditorial pour les titres, vert profond comme accent unique, icônes vectorielles nettes
(plus aucun emoji), neutres chauds (papier kraft).

La refonte couvre **4 écrans**, qui correspondent 1:1 à des routes déjà existantes dans `apps/web` :

| Maquette HTML (ce bundle) | Route Next.js cible |
|---|---|
| `FindYourJob - Foret.html` | `src/app/page.tsx` (landing) |
| `FindYourJob - Questionnaire.html` | `src/app/questionnaire/` |
| `FindYourJob - Resultats.html` | `src/app/resultats/` |
| `FindYourJob - Fiche metier.html` | `src/app/metiers/[…]/` |

## À propos des fichiers de design
Les fichiers `.html` de ce bundle sont des **références de design** (prototypes vanilla HTML/CSS/JS
montrant l'apparence et le comportement voulus). **Ne pas les copier tels quels.** La tâche est de
**recréer ces écrans dans l'environnement existant** : Next.js 15 (App Router), React 19,
Tailwind CSS v4, framer-motion — en réutilisant les patterns déjà en place dans le repo
(composants `Link`, structure des routes, `lib/storage.ts`, `lib/api.ts`, etc.).

## Fidélité
**Haute fidélité (hifi).** Couleurs, typo, espacements et interactions sont définitifs.
Reproduire fidèlement, en s'appuyant sur les tokens ci-dessous plutôt que sur des valeurs en dur.

---

## 1. Fondations à mettre en place d'abord

### 1.1 Polices (`next/font`)
Deux familles Google Fonts. À déclarer dans `src/app/layout.tsx` :

```tsx
import { Instrument_Serif, Space_Grotesk } from "next/font/google";

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// sur <html> : className={`${serif.variable} ${sans.variable}`}
```

- **Titres / chiffres éditoriaux** → `font-serif` (Instrument Serif, italique autorisé pour les accents).
- **Tout le reste (UI, corps, labels)** → `font-sans` (Space Grotesk).
- Supprimer Geist/Arial.

### 1.2 Tokens de couleur — `src/app/globals.css` (Tailwind v4, syntaxe `@theme`)
Remplacer le bloc `:root` / `@theme inline` existant par ceci. Le thème sombre est piloté par
`data-mode="dark"` sur `<html>` (toggle manuel), **pas** par `prefers-color-scheme`.

```css
@import "tailwindcss";
@custom-variant dark (&:where([data-mode="dark"], [data-mode="dark"] *));

:root {
  --paper:        #F0F2EB;  /* fond global (kraft clair) */
  --surface:      #FFFFFF;  /* cartes */
  --surface-2:    #F7F8FA;  /* surfaces secondaires / inputs */
  --ink:          #15171D;  /* texte principal */
  --ink-soft:     #3D424D;  /* texte secondaire */
  --muted:        #6F7682;  /* texte tertiaire */
  --line:         #E4E7EC;  /* bordures légères */
  --line-strong:  #D3D9E0;  /* bordures marquées */
  --panel:        #17161B;  /* panneaux foncés (CTA, pricing pro) */
  --on-panel:     #F4F2ED;
  --accent:       #1E7A4D;  /* VERT FORÊT — accent unique */
  --accent-soft:  #DCEFE3;  /* fond accent clair */
  --accent-ink:   #155C3A;  /* accent foncé (texte/icônes) */
  --ok:           #1E7A4D;
  --warn:         #B8862A;
  --no:           #C0473B;  /* « passe » dans le swipe */
}

[data-mode="dark"] {
  --paper:#0F1115; --surface:#181B21; --surface-2:#1E222A;
  --ink:#EEF0F3; --ink-soft:#CCD2DA; --muted:#8B93A0;
  --line:#272C35; --line-strong:#39404B;
  --panel:#0C0E12; --on-panel:#EEF0F3;
  --accent-soft: color-mix(in srgb, var(--accent) 16%, var(--surface));
  --accent-ink:  color-mix(in srgb, var(--accent) 58%, #FFFFFF);
  --warn:#E9B949;
}

@theme inline {
  --color-paper:        var(--paper);
  --color-surface:      var(--surface);
  --color-surface-2:    var(--surface-2);
  --color-ink:          var(--ink);
  --color-ink-soft:     var(--ink-soft);
  --color-muted:        var(--muted);
  --color-line:         var(--line);
  --color-line-strong:  var(--line-strong);
  --color-panel:        var(--panel);
  --color-on-panel:     var(--on-panel);
  --color-accent:       var(--accent);
  --color-accent-soft:  var(--accent-soft);
  --color-accent-ink:   var(--accent-ink);
  --color-ok:           var(--ok);
  --color-warn:         var(--warn);
  --color-no:           var(--no);
  --font-serif:         var(--font-serif);
  --font-sans:          var(--font-sans);
}

body { background: var(--paper); color: var(--ink); font-family: var(--font-sans); }
```

Après ça, les classes Tailwind `bg-paper`, `text-ink`, `border-line`, `bg-accent`,
`text-accent-ink`, `font-serif`, `dark:bg-surface`, etc. sont disponibles partout.

### 1.3 Toggle de thème
Bouton rond en haut à droite qui bascule `document.documentElement.dataset.mode`
entre `"light"` / `"dark"`, persisté dans `localStorage` sous la clé **`fyj-mode`**.
À lire au montage (idéalement un petit script inline anti-FOUC dans `layout.tsx`).

---

## 2. Table de correspondance (ancien → nouveau)

| Avant (indigo) | Après (Forêt) |
|---|---|
| `bg-indigo-600`, `text-indigo-600` | `bg-accent` / `text-accent-ink` |
| `bg-indigo-50` | `bg-accent-soft` |
| `text-slate-900` / `text-slate-600` | `text-ink` / `text-ink-soft` |
| `text-slate-500` | `text-muted` |
| `border-slate-200` | `border-line` |
| `bg-white` / `bg-slate-50` | `bg-surface` / `bg-surface-2` |
| fond de page `bg-white` | `bg-paper` |
| Titres `font-bold` Arial | `font-serif` (poids 400, gros) |
| Emoji (🎯🧠✍️📋) | icônes SVG ligne (stroke 1.6–1.9) — voir §5 |
| dégradé hero `from-indigo-50…` | fond plat `bg-paper`, accent réservé au mot clé en `italic text-accent` |
| coins `rounded-2xl` | titres en serif, cartes `rounded-[18px]` à `rounded-3xl` |

**Règle d'or :** l'accent vert est *rare* — un mot du titre en italique, les icônes, les états
sélectionnés, le bouton primaire au hover. Le reste vit en neutres chauds.

---

## 3. Spécifications par écran

> Les valeurs exactes (paddings, rayons, tailles de police, copy) sont dans les fichiers HTML.
> Ci-dessous, l'intention + les points qui ne se lisent pas dans le code.

### 3.1 Landing — `page.tsx`
- **Structure conservée** (hero, bande stats, problème, comment ça marche, différenciateurs,
  témoignages, tarifs, FAQ, CTA, footer). On reskin, on ne réorganise pas.
- **Hero** : fond `bg-paper` (plus de dégradé). H1 en `font-serif` ~clamp(46–84px), avec
  « qui te correspondent vraiment » en `italic text-accent`. À côté, un **mockup de classement**
  (carte `bg-surface` listant 3 métiers avec score + barre de progression) — voir le HTML.
- **Problème** : enlever le rouge des cartes ; numéro `01/02/03` en serif dans un cercle bordé accent.
- **Comment ça marche** : grandes étapes en lignes séparées par des filets, gros numéro serif.
- **Différenciateurs** : grille 2×2 bordée, icône dans une tuile `bg-accent-soft`.
- **Tarifs** : le plan « Rapport complet » utilise `bg-panel text-on-panel` (sombre) au lieu d'indigo ;
  badge « Recommandé » en `bg-accent`.
- **Boutons** : primaire = `bg-ink text-paper`, hover `bg-accent text-white`. Secondaire = bordé.

### 3.2 Questionnaire — `questionnaire/`
Flux mono-question, une carte centrée `max-w-[760px]`, barre de progression en haut.
**4 types de questions** (le moteur doit gérer le type, le HTML montre chacun) :
1. **single** — cartes radio empilées ; sélection = bordure+fond accent + coche ; **auto-avance** ~260 ms.
2. **multi** — chips arrondis (toggle vert) + `textarea` ; bouton *Continuer* actif dès qu'il y a une réponse.
3. **scale** — échelle 1→5 en gros boutons, libellés aux deux extrémités.
4. **text** — `textarea` seule (facultative possible).
- En-tête : lien retour accueil, compteur `X / N`, `% complété`, lien *Précédent*, toggle thème.
- **Persistance** : position + réponses dans `localStorage` (`fyj-quiz`) — à brancher sur le
  `lib/storage.ts` existant plutôt que réécrire.
- Transition d'entrée de carte : fade + translateY léger (`animation-fill-mode: both`, sinon framer-motion).
- Fin du flux → redirige vers `/resultats`.

### 3.3 Résultats — `resultats/`
**Deck de cartes à swiper** (style Tinder), une pile de 3 cartes en profondeur.
- Glisser à **droite = J'aime** (`--ok`), à **gauche = Passe** (`--no`) ; tampons « J'aime / Passe »
  qui apparaissent proportionnellement au déplacement.
- Carte : bandeau dégradé vert (`accent-ink → accent`), score d'adéquation, tagline, description,
  « pourquoi ça te correspond », missions clés, compétences (chips), salaire, lien *Voir la fiche complète*.
- **Contrôles** sous le deck : Passe / Annuler / J'aime (boutons ronds) + raccourcis clavier ← → et Backspace.
- Compteur j'aime / passés / progression. Écran de fin récapitulatif.
- Implémentation conseillée : **framer-motion** (déjà installé) — `drag="x"`, `dragConstraints`,
  `useMotionValue`/`useTransform` pour l'opacité des tampons et la rotation, `onDragEnd` qui décide
  selon le seuil (~110px) ou la vélocité. Mon HTML le fait à la main en `pointer events` ; en React,
  préférer framer-motion.
- *Voir la fiche complète* → route fiche métier.

### 3.4 Fiche métier — `metiers/[…]/`
Page longue, deux colonnes (contenu + sidebar sticky), `max-w-[920px]`.
- **En-tête** : eyebrow « Fiche métier », titre serif, sous-titre (domaine), pastilles
  (salaire, perspectives, niveau d'études) + **anneau de score** (conic-gradient sur `--accent`).
- **Sections numérotées** : 01 En bref (liste à coches), 02 Missions typiques (grille 2 col.),
  03 Pourquoi ça te correspond (bloc `bg-accent-soft`), 04 Points de vigilance (bloc `--warn`),
  05 trois étapes concrètes.
- **Sidebar** : compétences (chips), salaire/études/perspectives, encart CTA `bg-panel` « Plan d'action ».
- Bouton *Enregistrer* (état toggle), nav précédent/suivant en pied.
- Le contenu est par métier → alimenter depuis `lib/api.ts` (la donnée du HTML est un exemple « Développeur informatique »).

---

## 4. Design tokens (récap)
- **Couleurs** : voir §1.2 (toutes en hex, light + dark).
- **Typo** : Instrument Serif 400 (+italic) / Space Grotesk 400·500·600·700.
- **Rayons** : inputs/cartes `14–18px`, grandes cartes/panneaux `22–26px`, boutons & chips `999px`.
- **Ombres** : `0 30px 60px -32px rgba(20,40,25,.30)` pour les cartes flottantes ; sinon bordure `--line`.
- **Largeurs** : landing `1180px`, questionnaire `760px`, résultats deck `440px`, fiche `920px`.
- **Stroke icônes** : 1.6 à 1.9, `fill:none`, `linecap/linejoin: round`.

## 5. Assets / icônes
Aucune image bitmap. Toutes les icônes sont des **SVG line inline** (set type Lucide/Feather :
check, flèche, ampoule, cible, cœur/pouce, triangle d'alerte, etc.). Reprendre les `path` directement
depuis les fichiers HTML, ou installer `lucide-react` (équivalents : `Check`, `ArrowRight`, `Heart`,
`ThumbsDown`, `AlertTriangle`, `Target`, `Lightbulb`, `Bookmark`, `Clock`, `GraduationCap`).
**Retirer tous les emoji** des fichiers `data` (`page.tsx` : `DIFFERENTIATORS`, bloc problème).

## 6. Fichiers de référence dans ce bundle
- `FindYourJob - Foret.html` — landing complète
- `FindYourJob - Questionnaire.html` — moteur de questionnaire (4 types)
- `FindYourJob - Resultats.html` — deck à swiper
- `FindYourJob - Fiche metier.html` — fiche métier détaillée

## 7. Ordre d'implémentation suggéré
1. Fonts + tokens (§1) — base partagée, rien de visible casse.
2. `page.tsx` (reskin, structure identique) — valide les tokens sur du contenu réel.
3. Toggle thème + persistance.
4. `questionnaire/` (brancher sur `lib/storage.ts`).
5. `resultats/` (framer-motion).
6. `metiers/` (brancher sur `lib/api.ts`).
7. Mettre à jour les tests e2e (`landing.spec.ts`, `questionnaire.spec.ts`) si des sélecteurs/textes changent.
