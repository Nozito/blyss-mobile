# DESIGN_34 — Refonte design de l'onboarding client nails (mobile iOS)

> PR #12 (DRAFT). Stack réelle : **Expo / React Native** (pas SwiftUI natif) —
> les principes « Apple-friendly » sont transposés aux APIs Expo équivalentes
> (`expo-blur`, `expo-haptics`, `react-native-reanimated`, `expo-linear-gradient`,
> `expo-image`). Onboarding **skippable partout**, jamais bloquant, centré nails.

## Direction retenue — « poster editorial × DA » (passe 3b, validée 2026-09-06)

Historique : passe 1 « fluid glass » puis passe 2 « B ancré » jugées trop
génériques/IA → **passe 3b**. Artefact de revue :
`claude.ai/code/artifact/d803d604-20af-46ee-b63b-ac0393506c70`.

**Système unique sur les 7 écrans :**

- **Zéro emoji.** Chips → libellé + code `NL·0x` ; features → numéro + phrase ;
  « pour ton style » → `✦` + label ; rareté → pastille pleine.
- **Titres** des écrans bornes en `fontWeight: "900"` capitales, tracking négatif
  (SF Pro Black sur iOS, **aucune police embarquée**). Playfair abandonné ici.
- **3 fonds pleins, tokens uniquement** : rose `colors.primary` `#FE5D9D` (01, 05),
  cream `colors.cream` `#F8F5F1` (03, 04, 07), **prune** `#3D1F2C` (02, 06 — encre
  fixe `#1A0710`/`#F6E9EE`, couleur assumée dans les deux thèmes). Doré = accent seul.
- **Header** = numéro d'étape géant `01`–`07` (vraie séquence) + « Plus tard » /
  « Passer ». Rien d'autre — pas de libellé d'écran. Filet 2 px rempli à `step/7`.
- **Boutons pilule** (rayon 999) pleine largeur, libellé capitales court **sur une
  ligne** (`numberOfLines={1}`).
- **Cartes reco** = lignes éditoriales (filet 1 px, photo carrée arrondie duotone,
  nom en 900). Plus de carte à ombre. Bouton `♥` = suivre la pro sans quitter.
- **Erreurs** : aucun code technique affiché. Notification flottante
  `FloatingNotice` — **exactement la capsule Liquid Glass de `OfflineBanner`**
  (matériau commun extrait dans `NoticeCapsule`), même position, même animation,
  auto-fermeture 4 s. Copies courtes et impératives : « On n'a pas pu enregistrer,
  réessaie », « On n'a pas pu charger les pros, réessaie ». Côté serveur, le
  middleware `validate()` renvoie désormais un `message` FR lisible.
- **Ruban de transition** : rayures diagonales rose × prune (façon rubalise) qui
  balaie l'écran à chaque passage — ~520 ms, 2 temps (couvre à `translateX -0.5w`
  → `setStep` → découvre à `-2.2w`, ruban large `2w` pour sortir complètement),
  haptique `Light` à la couverture, `useReducedMotion()` → `FadeIn`. N'existe
  **que** pendant la transition.
- Aucune dépendance mobile ajoutée.

### Ordre des 7 écrans (revu côté comportemental)

| # | Écran | Fond | Levier |
|---|---|---|---|
| 1 | Bienvenue (pas d'eyebrow, titre 44 pt, sticker « 1 minute chrono » sans étoile) | rose | ancrage valeur + preuve sociale |
| 2 | **Comment ça marche** (ex-carousel dissous) | prune | réciprocité — rassure (« tu payes à l'institut ») avant de demander |
| 3 | Préférences (**style multi-choix** + ville avec **aperçu carte** Apple géocodé) — défile | cream | foot-in-the-door + effet IKEA |
| 4 | **« Choisies pour toi »** + `♥` favori (+ état vide « pas de pro à {ville} ») | cream | récompense : preuve sociale, rareté, proximité |
| 5 | Notifications (pré-permission) | prune | l'ask au pic d'intention |
| 6 | Comment tu as connu Blyss (`acquisition_source`) | cream | valeur nulle → skippable (« Passer ») |
| 7 | **CTA premier RDV — dernier** | rose | closer ; « Réserver » sort, « Explorer » → `/complete` |

**CTA en dernier** : si la cliente part réserver, elle a déjà vu notifications +
attribution (concern produit). Tap sur une ligne reco à l'écran 4 reste possible
(gros convertisseurs — relance notif contextuelle post-résa).

Le **carousel de features est supprimé** ; l'axe « prestation » (services) est
abandonné. Le **`♥` favori réutilise `POST /api/favorites`** (table `favorites`
existante) — pas une nouvelle notion.

**Écran 3 — localisation** : le champ ville/CP est géocodé sur l'appareil
(`Location.geocodeAsync`) → aperçu **`MapView` `PROVIDER_DEFAULT`** (Apple Maps
iOS) non interactif, un pin, label ville. Les coords sont passées à
`getRecommendations({ city, lat, lng })`.

**Écran 4 — « Choisies pour toi »** : la reco backend classe par paliers
(style + région → région → style → mieux notées), « région » = ville qui matche
ou pro à < 40 km du point géocodé (distance sur le point public, jamais
l'adresse exacte). Chaque pro porte `in_region` + `distance_km` (affichée en km
dans la ligne méta). Wording retenu **« Choisies pour toi »** (aussi appliqué au
header « Sélection Blyss » de la home cliente, pour l'unité).

### Dépendances backend blyss-app (PR #38)

- migration `20260909000001` : `client_preferences.styles nail_style[]`
  (`style_nails` conservé = `styles[0]`), `client_onboarding.acquisition_source`,
  `current_step` CHECK `0..7`.
- `POST /preferences` accepte `styles[]` ; `/status` + `/recommendations`
  renvoient `styles` ; reco matche sur `= ANY(styles)`.
- `POST /attribution` `{ source }` → `acquisition_source`.

`/attribution` est appelé en **best-effort** (`.catch(() => {})`).

---

## 1. Benchmark — synthèse

Analyse des parcours d'onboarding de référence (App Store / Mobbin / usage direct,
sept. 2026). Pas d'accès automatisé aux galeries derrière login — synthèse
qualitative.

| App | Ce qui marche | Biais cognitif exploité | À reprendre pour Blyss |
|---|---|---|---|
| **Doctolib** | 1 question par écran, géoloc en 1 champ, zéro friction | Engagement progressif, autorité (praticiens vérifiés) | Champ ville unique + libellé « pros vérifiées » |
| **Calendly** | Écran CTA minimal, une seule action évidente | Loi de Hick (1 choix), closure | Écran 4 : un CTA primaire, un lien discret |
| **Booksy / StyleSeat** | Cartes pros avec photo, note, « X créneaux » | Rareté / preuve sociale, effet de dotation (créneau « à toi ») | Écran 3 : cartes reco avec badge rareté live |
| **Airbnb** | Cartes visuelles plein cadre, dégradé sur photo, note ★ | Traitement esthétique-usabilité, ancrage visuel | Overlay dégradé + note ★ sur les cartes |
| **Uber** | Onboarding ≤ 4 écrans, skip toujours visible | Aversion à la perte faible (non bloquant) | « Plus tard » permanent en haut à droite |
| **Instagram / TikTok** | Carousel features 3 slides, swipe, dots animés, plein écran | Effet de simple exposition, curiosité | Écran 5 : carousel paginé + dots animés |

### À copier / adapter / éviter

- **Copier** : 1 idée par écran ; skip permanent ; carousel features swipeable ;
  cartes pros visuelles ; badge de rareté ancré sur des données réelles.
- **Adapter** : preuve sociale = volume de RDV (« des milliers de RDV nails / mois »),
  pas d'avis inventés ni d'offre de bienvenue (Blyss ne la prend pas en charge).
- **Éviter** : écrans de permissions empilés au démarrage ; formulaires longs ;
  « 8 étapes » façon SaaS B2B ; multi-select à 12 options.

---

## 2. Ressources design & MCP

- **MCP configurés dans la session** : `21st` (catalogue de composants UI),
  `claude-in-chrome` (captures de références), `computer-use`. Aucun MCP de
  génération d'illustration n'a été branché — les visuels de l'onboarding restent
  des **emojis système + formes glass**, choix volontaire (poids nul, cohérent
  iOS, rendu identique light/dark, zéro asset à maintenir).
- **Galeries de référence** : Mobbin (onboarding iOS réservation), Pageflows,
  App Store (Booksy, StyleSeat, Doctolib, Fresha). Non scrapées automatiquement
  (login requis) — observation manuelle.
- **Piste illustrations** (non retenue pour cette itération, à rouvrir si besoin) :
  Rive / Lottie pour une animation d'accueil ; coût = +1 lib runtime + assets.

---

## 3. Principes de design appliqués

### Apple-friendly (transposition Expo)

| Objectif Apple | Implémentation Blyss |
|---|---|
| SF Pro | Corps = police système RN ; titres écrans bornes = **SF Pro Black** (`fontWeight: "900"` + capitales + tracking négatif, zéro police embarquée) ; titres écrans fonctionnels = `PlayfairDisplay_700Bold` (`Fonts.serif`, identité de marque) |
| Couleurs natives | Palette `useThemeColors()` (source unique `constants/colors.ts`), rose de marque `#FE5D9D` comme accent |
| Fluid Glass | `expo-blur` `BlurView` sur la pilule de progression, le footer collant CTA ; `tint` suit le thème |
| Profondeur | Dégradés `expo-linear-gradient` plein écran teintés marque (clair) / profonds (sombre) ; `Shadows.soft` / `Shadows.card` |
| Animations fluides | `react-native-reanimated` — `FadeInDown` / `FadeIn` à l'entrée de chaque écran et des cartes (delay progressif) |
| Haptic (Taptic Engine) | `expo-haptics` — `selectionAsync` sur les choix, `impactAsync(Light/Medium)` sur les CTA, `notificationAsync(Success)` à la fin |
| Dark Mode | Complet via `useThemeColors()` + `useIsDarkMode()` — dégradés, glass tint, opacités adaptés |

### Performance

- Zéro nouvelle dépendance. Emojis + formes (pas d'images d'illustration).
- `expo-image` pour les photos pros : cache disque, `transition`, `contentFit`.
- Carousel features = `ScrollView` natif `pagingEnabled` (pas de lib).
- Pas de re-render inutile : état local, pas de contexte ajouté.

---

## 4. Spécs écran par écran

> ⚠️ **Obsolète — décrit la passe 2 « B ancré » (5 écrans).** La passe 3b
> validée compte **7 écrans** dans un ordre différent (voir « Direction retenue »
> en tête de doc et l'artefact). Section conservée pour l'historique des biais
> cognitifs, qui restent valables ; l'implémentation de référence est
> `app/client-onboarding.tsx`.

### Écran 1 — Bienvenue *(borne, voix affirmée)*
- **Fond rose `#FE5D9D` plein cadre**, encre `#1A0710`.
- Eyebrow « ✦ BLYSS · ONGLERIE ».
- Titre **display 42 pt, poids 900, capitales, tracking serré** : « Tes ongles
  méritent mieux ».
- Sticker incliné −3° sur fond encre : « ✦ 1 MINUTE CHRONO ».
- Corps 15 pt (`#1A0710` opacity .9) : la promesse claire (pros près de toi,
  vrai travail, vraies dispos).
- Ligne preuve sociale : « Des milliers de RDV nails réservés chaque mois ».
- Bouton **pilule noir** `ON Y VA` pleine largeur. « Plus tard » dans le header.
- Anim `FadeInDown` 500 ms, haptique `Medium` au tap.
- **Biais** : preuve sociale, ancrage valeur, rareté douce (« 1 minute »). Pas de promo.

### Écran 2 — Préférences + localisation
- Titre serif « Quel style tu préfères ? » + sous-titre justification (« ça nous
  aide à te présenter les bonnes pros » → effet de réciprocité / IKEA).
- **Grille 2 colonnes** de 6 tuiles style (emoji + label), sélection **unique**
  (contrat API `setPreferences(style, city)` inchangé), bordure + fond rose +
  ombre douce + ✓ animé quand sélectionné. `FadeInDown` en cascade (delay 40 ms).
- Champ ville avec icône 📍, **anneau de focus rose** (`cityFocused`).
- Footer glass : `Continuer`, désactivé tant qu'aucun style choisi.
- Haptique `selectionAsync` à chaque tuile, `Medium` sur Continuer.
- **Biais** : engagement progressif, escalade d'engagement (petit oui → grand oui).

### Écran 3 — Recommandations
- Titre serif adapté au style choisi (« Nos pros french / nude pour toi »),
  sous-titre localisé (« Autour de {ville} »).
- 3 cartes pro (`FadeInDown` en cascade) :
  - Photo bannière `expo-image` 128 pt + **overlay dégradé** bas.
  - Badge « ✨ Pour ton style » ancré en haut-gauche si `matches_style`.
  - Nom 17 pt bold, ★ note + « · N avis », ville.
  - **Badge rareté** (pastille rose, point plein) : « 2 créneaux aujourd'hui » /
    « 5 créneaux cette semaine » depuis `open_slots` — sinon « Voir les
    disponibilités ».
  - Toute la carte est tappable → `router.push('/specialist/{id}')`.
- Footer glass : `Continuer`.
- **Biais** : rareté (créneaux réels), preuve sociale (note/avis), effet de
  dotation (le créneau « pour toi »), esthétique-usabilité.

### Écran 4 — CTA premier RDV
- Icône 📅 tuile glass. Titre serif « Prête pour ton premier RDV ? ».
- Corps personnalisé : « {pro} a de la place. Réserve ton créneau en quelques
  taps, 24/7. »
- Footer glass : CTA primaire `Prendre RDV avec {pro}` + lien ghost
  `Voir ce que Blyss propose`.
- **Biais** : loi de Hick (1 action), closure, urgence douce (24/7 + « a de la place »).

### Écran 5 — Carousel features *(borne, voix affirmée)*
- `ScrollView` horizontal `pagingEnabled`, 3 slides **plein cadre coloré** :
  1. 📅 « RÉSERVE EN 3 TAPS » — champ rose `#FE5D9D`, encre `#1A0710`
  2. 🔔 « ON TE RAPPELLE AU BON MOMENT » — champ doré `#DBA970`, encre `#1A0710`
  3. 💬 « TOUT AU MÊME ENDROIT » — champ encre `#1A0710`, texte blanc (slide inverse)
- Emoji 52 pt, titre **display 38 pt poids 900 capitales**, corps 15 pt.
- Dots animés (barre active 22 pt), encre adaptée au fond de la slide.
- Bouton **pilule** (noir, ou blanc sur la slide inverse) `SUIVANT` puis
  `COMMENCER À EXPLORER` → `complete`.
- Haptique `selectionAsync` au swipe, `notificationAsync(Success)` à la fin.
- **Biais** : simple exposition, curiosité, closure finale.

---

## 5. Micro-interactions

| Interaction | Détail |
|---|---|
| Entrée d'écran | `FadeInDown` (héros) / `FadeIn` (listes) Reanimated |
| Cartes / listes | Cascade `FadeInDown.delay(i * 40–80)` |
| Tap CTA | Scale-down spring (`LoadingButton` existant) + haptique `Light`/`Medium` |
| Tap tuile style | `AnimatedPressable` scale 0.95 + `selectionAsync` + ✓ `FadeIn` |
| Champ ville focus | Bordure → rose, icône → rose |
| Swipe carousel | `pagingEnabled` natif + `selectionAsync` + dot actif animé |
| Fin d'onboarding | `notificationAsync(Success)` |
| Loading recos | `ActivityIndicator` natif (pas de skeleton custom ici) |

---

## 6. Dark Mode

- Dégradé de fond : `#FFF1F6 → bg → #FFE1EC` (clair) / `bg → #141013 → bg` (sombre).
- `BlurView tint` = `light` / `dark` selon `useIsDarkMode()`.
- Opacités de fond des tuiles/badges relevées en sombre (0.14–0.16 vs 0.08–0.10).
- Bordures glass : `withAlpha(foreground, 0.06)` clair / `0.10` sombre.
- Texte : `foreground` / `mutedForeground` de la palette (contrastes AA vérifiés
  sur la palette existante).

---

## 7. Implémentation technique

- **Fichier** : `app/client-onboarding.tsx` (réécrit, ~560 lignes, 1 seul écran-route).
- **Contenu** : `lib/clientOnboardingContent.ts` (copies, `tint` par slide, preuve sociale).
- **Composants réutilisés** : `LoadingButton`, `AnimatedPressable`, `useToast`,
  `useThemeColors`, `Fonts`, `Shadows`, `withAlpha`.
- **Nouveaux imports** : `expo-blur`, `expo-linear-gradient`, `expo-image`,
  `react-native-reanimated` (tous déjà dans `package.json`).
- **API inchangée** : `clientOnboardingApi` (status / setPreferences /
  getRecommendations / tapCta / complete / skip), reprise `?from=settings`,
  `GET /status` au lancement.

### Extrait — footer glass

```tsx
const StickyFooter = ({ children }) => (
  <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"}
    style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 8,
      borderTopWidth: 1, borderTopColor: withAlpha(colors.foreground, 0.05) }}>
    {children}
  </BlurView>
);
```

### Extrait — badge rareté

```tsx
{r.open_slots.this_week > 0 && (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: withAlpha(colors.primary, 0.1) }}>
    <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: colors.primary }} />
    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12.5 }}>
      {r.open_slots.today > 0
        ? `${r.open_slots.today} créneaux aujourd'hui`
        : `${r.open_slots.this_week} créneaux cette semaine`}
    </Text>
  </View>
)}
```

---

## 8. Tracking PostHog (passe 3b)

Payloads détaillés = `docs/client-onboarding-tracking.md`.

| Event | Déclencheur |
|---|---|
| `onboarding_started` / `onboarding_resumed` | montage écran (selon `from`) |
| `onboarding_preferences_selected` | validation écran 3 — **`styles`** / `styles_count`, `has_location`, `location` |
| `onboarding_recommendations_viewed` | chargement recos (écran 4) — `results_count`, `empty`, `pro_ids`, `had_scarcity`, `style_filter_active`, `styles` |
| `onboarding_pro_followed` **▸ nouveau** | tap `♥` sur une ligne reco — `pro_id`, `position` (double `POST /api/favorites`) |
| `onboarding_notif_prompted` **▸ nouveau** | écran 5 affiché — `from` (`onboarding` / `empty_state`) |
| `onboarding_notif_result` **▸ nouveau** | `granted` / `denied` / `later` / `error` |
| `onboarding_attribution` **▸ nouveau** | tap d'une source à l'écran 6 — `source` |
| `onboarding_cta_tapped` | tap ligne reco ou CTA écran 7 (dernier) — `pro_id`, `position`, `from` |
| `onboarding_completed` | écran 7 (Réserver / Explorer / Passer) — `steps_seen` = 7 |
| `onboarding_skipped` | « Plus tard » / « Fermer » (`at_step`) |

---

## 9. Push notifications

Copies proposées dans `docs/client-onboarding-push-copy.md`. Configuration
d'envoi côté backend (#34 PR 1/3, cron J+1 / J+3 / J+7) — le mobile ne fait que
recevoir via `expo-notifications` déjà branché dans `AppDelegate` / `app.config`.

---

## 10. Critères d'acceptation

- [x] Benchmark synthétisé (6 apps de référence, tableau + à copier/adapter/éviter).
- [x] Ressources / MCP documentés (choix emoji + glass assumé).
- [x] 5 écrans refondus, design transposé Apple-friendly (glass, dégradés, reanimated).
- [x] Micro-interactions : haptique sur chaque tap, entrées animées, focus ring, dots animés.
- [x] Dark Mode complet.
- [x] Tracking PostHog inchangé et couvert.
- [x] Copies push (doc dédié).
- [x] `tsc` + `eslint` (0 nouvelle erreur) + `jest __tests__/client` (8/8) OK.
- [ ] Revue visuelle sur simulateur iOS — **bloquée tant que le build #20 n'est pas approuvé** (contrainte PR #12).
