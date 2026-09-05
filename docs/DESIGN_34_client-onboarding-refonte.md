# DESIGN_34 — Refonte design de l'onboarding client nails (mobile iOS)

> PR #12 (DRAFT). Stack réelle : **Expo / React Native** (pas SwiftUI natif) —
> les principes « Apple-friendly » sont transposés aux APIs Expo équivalentes
> (`expo-blur`, `expo-haptics`, `react-native-reanimated`, `expo-linear-gradient`,
> `expo-image`). Onboarding **skippable partout**, jamais bloquant, centré nails.

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
| SF Pro | Police système RN par défaut pour le corps ; `PlayfairDisplay_700Bold` (`Fonts.serif`) pour les titres — identité de marque existante |
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

## 4. Les 5 écrans (spécs)

### Écran 1 — Bienvenue
- Icône 💅 dans une tuile glass arrondie (`borderRadius: 28`, ombre douce).
- Eyebrow rose capitales « BIENVENUE SUR BLYSS ».
- Titre serif 30 pt : « Trouve LA prothésiste ongulaire qu'il te faut ».
- Corps 15 pt muted, 1 phrase.
- Ligne preuve sociale : ✨ « Des milliers de RDV nails **réservés chaque mois** ».
- Footer glass collant : bouton plein `C'est parti`. « Plus tard » dans le header.
- Anim : `FadeInDown` 500 ms sur le bloc. Haptique `Light` au tap.
- **Biais** : preuve sociale + ancrage valeur, pas de promo.

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

### Écran 5 — Carousel features
- `ScrollView` horizontal `pagingEnabled`, 3 slides plein écran :
  1. 📅 « Réserve en quelques taps » (accent rose)
  2. 🔔 « On te rappelle au bon moment » (accent info/bleu)
  3. 💬 « Tout est au même endroit » (accent secondaire/doré)
- Tuile emoji 104 pt, titre serif 27 pt, corps 15 pt.
- Dots animés (barre active 22 pt) dans le footer glass.
- Bouton `Suivant` (scroll programmatique) puis `Commencer à explorer` → `complete`.
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

## 8. Tracking PostHog

Events inchangés (payloads = `docs/client-onboarding-tracking.md`) :

| Event | Déclencheur |
|---|---|
| `onboarding_started` / `onboarding_resumed` | montage écran (selon `from`) |
| `onboarding_preferences_selected` | validation écran 2 (`style_nails`, `has_location`, `location`) |
| `onboarding_recommendations_viewed` | chargement recos (`results_count`, `pro_ids`, `had_scarcity`, `style_filter_active`) |
| `onboarding_cta_tapped` | tap carte reco ou CTA écran 4 (`pro_id`, `position`, `from`) |
| `onboarding_completed` | fin du carousel (`steps_seen`) |
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
