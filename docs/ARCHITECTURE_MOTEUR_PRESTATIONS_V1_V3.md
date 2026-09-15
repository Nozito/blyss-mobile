# Architecture cible — Moteur de prestations Blyss V1 → V3

Document technique. Version verrouillée le 2026-09-15 — toutes les décisions produit ouvertes de la première version ont été arbitrées par le fondateur (voir §0). Le développement peut démarrer sur cette base pour V1, V2 restant bloquée sur l'implémentation du garde-fou RGPD décrit en §9.2.

Légende utilisée dans tout le document :
- **DECISION TECHNIQUE** — choix d'implémentation, tranché ici, réversible sans impact produit.
- **DECISION PRODUIT (verrouillée)** — arbitrage explicite du fondateur, ne doit plus être remis en question sans nouvelle discussion.

---

## 0. Décisions verrouillées (2026-09-15)

| # | Sujet | Décision |
|---|---|---|
| 1 | Règle du "à partir de" | Prix plancher réellement atteignable = `prestation.price + Σ min(price_delta)` par groupe **obligatoire**, jamais un prix théorique non réservable (§6.1). |
| 2 | Variantes obligatoires vs facultatives dans le calcul | Seuls les groupes **obligatoires actifs** influencent le "à partir de" ; groupes facultatifs et options n'y participent jamais (§6.5). |
| 3 | Sélection multiple dans un groupe de variantes | Pas exposée en V1, mais `variant_groups.selection_mode` modélisé dès le schéma pour rester compatible sans migration future (§7.1). |
| 4 | Exclusion entre options | Aucune règle d'exclusion en V1 (§8). |
| 5 | Questions sensibles / RGPD (V2) | Flag `is_sensitive` sur les questions + détection assistée par mots-clés à la création, avec consentement dédié côté cliente quand le flag est actif (§9.2). Bloquant pour le développement V2. |
| 6 | Ordre des prestations en V3 | `ordering_rank` numérique par prestation (pas de contraintes pair-à-pair, pas de détection de cycles) ; le panier se trie automatiquement par rang croissant ; rangs suggérés par défaut, ajustables librement par la pro (§10, §14.3). |
| 7 | Dépréciation des colonnes legacy `reservations` | Dual-write indéfini, pas de date de suppression programmée. `reservation_items` devient la source de vérité fonctionnelle dès V1 ; les colonnes plates historiques restent alimentées en parallèle pour compatibilité descendante mobile, sans dépendance fonctionnelle nouvelle dessus. Le drop sera un chantier de cleanup séparé, décidé plus tard (§16.3). |
| 8 | Prix/durée négatifs | **Bloquer la configuration incohérente à l'écriture**, pas de correction silencieuse à la réservation (§5.3, révise la V1 du rapport qui proposait un clamp). |
| 9 | Stratégie de snapshot | Tables normalisées (`reservation_item_variants`, `reservation_item_options`, `reservation_item_answers`), pas de JSONB (§3, révise la V1 du rapport). |

---

## 1. Architecture actuelle

### 1.1 Modèle Prestations

Table `prestations` (`blyss-app/supabase/migrations/20260227000001_schema.sql:81-97`), complétée par deux migrations additives :
- Base : `id`, `pro_id`, `name`, `description`, `price NUMERIC(10,2)`, `duration_minutes`, `active`, `created_at`/`updated_at`.
- `20260412000002_nail_tech_features.sql:6-11` : `preparation_instructions`, `recall_weeks`, `buffer_after_minutes`.
- `20260902000001_availability_engine.sql:58-65` : `buffer_before_minutes`, `booking_lead_time_minutes`, `booking_horizon_days`, `is_online_bookable`.

Une prestation = **une ligne plate** : un prix fixe, une durée fixe. Aucune notion de variante, d'option, de `pricing_mode`, ou de "à partir de" n'existe dans le schéma, le code backend (`grep` exhaustif négatif) ni le mobile.

### 1.2 Modèle Réservations

Table `reservations` (`20260227000001_schema.sql:124-147`) : `client_id`, `pro_id`, `prestation_id` (**FK simple vers une seule prestation**, pas de table de jonction), `start_datetime`/`end_datetime`, `status`, `price` (figé à l'insert), `paid_online`, `payment_status`, `total_paid`, `deposit_amount`.

Snapshot déjà partiellement en place (`20260902000001_availability_engine.sql:113-119`) : `service_duration_minutes`, `buffer_before_minutes`, `buffer_after_minutes`, `blocked_start_datetime`, `blocked_end_datetime`, `timezone`. Commentaire de migration explicite : *écrits une seule fois à la création, jamais recalculés si la prestation change ensuite*.

**Faille identifiée** : le **nom** de la prestation n'est pas snapshoté. Toutes les requêtes de listing (`server.ts:1665, 1883, 2313, 3702, 3725, 3863, 3973, 5669, 5752, 5963`) font un `JOIN` live sur `prestations.name`. Si la pro renomme une prestation, l'historique affiche rétroactivement le nouveau nom — contradiction directe avec l'exigence du §3 de ce rapport.

**Faille structurelle plus grave** : le service layer (`reservation.service.ts`) accepte déjà `serviceIds: number[]` (tableau), calcule un prix et une durée **additionnés sur plusieurs prestations** (§1.3, §1.4), mais à l'insertion ne persiste que `serviceIds[0]` comme `prestation_id` (`reservation.service.ts:362`), et le nom stocké devient la chaîne générique `"${n} prestations"` (ligne 184). **Si une réservation multi-prestations était créée aujourd'hui via ce chemin, l'identité des prestations 2..n serait perdue de façon irréversible** — seuls le prix total et la durée totale survivent. C'est le symptôme le plus clair que le backend a déjà commencé, sans table de jonction, à anticiper le multi-prestations sans être allé au bout.

### 1.3 Modèle disponibilité

Moteur de dispo dédié (`blyss-app/backend/services/availability.service.ts`, 891 lignes), migré progressivement (tables `slots` et `reservations.slot_id` supprimées, `20260913000001_drop_slots_table.sql` et `20260904000002_drop_reservations_slot_id.sql`) vers un calcul dynamique basé sur `working_hours` (table dédiée) moins les indisponibilités et les réservations déjà bloquantes.

Point clé déjà correct et à **conserver tel quel** pour la cible V3 : `resolveServiceBlocking()` (`availability.service.ts:247-264`) sait déjà additionner durée + buffers de **plusieurs** prestations demandées simultanément (buffer avant = 1ʳᵉ prestation, buffer après = dernière, buffers intermédiaires cumulés). Cette logique est un embryon direct du calcul multi-prestations V3, juste privé aujourd'hui de la table de jonction qui lui permettrait de persister le détail.

### 1.4 Service de réservation

`reservation.service.ts:createReservation()` (153-409), déjà **unifié** entre flow client (`POST /api/reservations`) et flow pro (`POST /api/pro/appointments`) — un ancien doublon a été résorbé (commentaire ligne 4-6). Séquence : autorisation override → lookup prestations scopé pro → **prix = somme serveur des `prestations.price`** (jamais lu depuis le body client, `reservation.service.ts:183`) → vérification blocklist client → pré-check dispo → gestion conflit/override → transaction avec verrou advisory Postgres (`pg_advisory_xact_lock`, `withProReservationLock`, lignes 102-119) → re-check sous verrou → calcul acompte → `INSERT` avec tout le snapshot → notification post-commit.

C'est une base saine : centralisation du calcul de prix côté serveur, transaction verrouillée, snapshot déjà pensé. Le point faible est uniquement l'absence de table de détail par élément (§1.2).

### 1.5 Calcul du prix / durée

- **Prix** : somme brute des `prestations.price` des services demandés. Pas de moteur de règles, pas de remise, pas de variante/option qui modifierait ce total.
- **Durée** : additive avec buffers, algorithme déjà correct pour le multi-item (§1.3). Contraintes CHECK sur les buffers : valeurs autorisées `{0,5,10,15,20,30}` (`nail_tech_features.sql:11`, `availability_engine.sql:60`, répliqué dans `validate.ts:33-38`).

### 1.6 Création/modification de rendez-vous

- Cliente : `POST /api/reservations` (`server.ts:6409`), body avec `prestation_id` **singulier**.
- Pro : `POST /api/pro/appointments` (`server.ts:4857-4929`), modèle "relation-only" (le client doit avoir une réservation `confirmed`/`completed` préexistante avec cette pro).
- Report : `backend/services/reschedule.service.ts` + `backend/routes/reschedule.routes.ts`, recalcule le snapshot à l'acceptation (`reschedule.service.ts:289-292`).

Côté mobile, deux mécanismes distincts de reschedule, **aucun ne relit le prix** :
- Self-service cliente (`app/(client)/bookings.tsx`, modal ~120-156) : `end = start + booking.duration_minutes` — lit le champ **figé** sur la réservation, n'appelle jamais la config actuelle de la prestation. Payload envoyé au serveur : uniquement les nouvelles dates.
- Proposition pro (`app/reschedule-request/[id].tsx`) : le type API (`lib/api.ts:1022-1039`) contient déjà `proposed_prestation_id` et `proposed_price` — le backend anticipe un changement de prestation/prix au reschedule — mais **l'écran mobile n'affiche que les dates**, aucune UI pour le prix ou la prestation proposée. Décalage backend/mobile déjà présent aujourd'hui, à corriger indépendamment de ce chantier.

### 1.7 Duplication d'une prestation

`POST /api/pro/prestations/:id/duplicate` (`server.ts:1563-1594`) existe déjà côté backend et côté mobile (`services.tsx:213`, bouton "dupliquer"). **Bug constaté** : la requête `INSERT` ne copie que `name` (+ " (copie)"), `description`, `price`, `duration_minutes`, force `active=false` — elle **omet** `buffer_before_minutes`, `buffer_after_minutes`, `preparation_instructions`, `recall_weeks`, `booking_lead_time_minutes`, `booking_horizon_days`, `is_online_bookable`. La duplication actuelle est déjà incomplète par rapport au schéma présent, avant même d'ajouter variantes/options/questions.

### 1.8 Modification/suppression/désactivation

`PATCH /api/pro/prestations/:id` pour la modification partielle. `DELETE /api/pro/prestations/:id` est un **hard delete SQL**, bloqué par la contrainte FK si des réservations existent (catch du code Postgres `23503`, 409 avec message suggérant de désactiver). Pas de colonne de soft-delete : `active` est le seul mécanisme de désactivation logique, distinct de la suppression physique.

### 1.9 Historique des rendez-vous

Backend : snapshot prix/durée/buffers/créneau figé (§1.2), mais nom non figé (bug identifié). Mobile : **il n'existe aujourd'hui aucun écran d'historique détaillé des rendez-vous d'une cliente** — `app/(pro)/(clients)/client-detail.tsx` n'affiche que deux agrégats (`totalVisits`, `lastVisit`), sans liste des RDV ni détail des prestations effectuées. C'est un vide fonctionnel préexistant, indépendant de ce chantier mais qui deviendra plus visible une fois le multi-prestations et les variantes en place (l'historique aura alors davantage à montrer) — intégré à la roadmap V3 (§20).

### 1.10 Types TypeScript actuellement dupliqués côté mobile

Aucune source de vérité unique :
- **`Service`/`Prestation`** défini séparément dans `app/(pro)/(profile)/services.tsx:17-26`, `service-form.tsx:36-45` (copie identique), `public-profile.tsx:44` (version réduite), `components/screens/client/booking/ServiceSelector.tsx:10-16` (exporté et réutilisé par `booking.tsx:21`), `components/screens/pro/calendar/NewAppointmentSheet.tsx:25-29` (définition indépendante).
- **`Booking`/réservation** défini séparément dans `app/booking/[id].tsx:34-64` (le plus riche), `app/(client)/bookings.tsx:30-45`, `components/BookingCard.tsx:17-31`, `app/(client)/index.tsx:58` — quatre définitions divergentes (présence ou non de `description`, `buffer_*`, `cancellation_notice_hours`, `payment_status`…).

Ce point est **critique** pour la suite : ajouter `variant_id`, `options[]`, `pricing_mode`, `answers[]` sans source de vérité unique obligerait à répliquer chaque champ dans 6-7 endroits, avec risque de divergence silencieuse (ex. un écran qui affiche encore l'ancien prix parce qu'il lit un type non mis à jour).

### 1.11 Dépendances entre ces éléments

```
prestations (backend)
   │ FK simple (1..1)
   ▼
reservations.prestation_id ──► snapshot (price, duration, buffers, blocked_start/end)
   │
   ├─ consommé par availability.service.ts (calcul créneaux libres = working_hours − réservations bloquantes)
   ├─ consommé par reservation.service.ts (création, sous verrou advisory par pro_id)
   ├─ consommé par reschedule.service.ts (report, recalcule snapshot à l'acceptation)
   └─ affiché par 4+ types mobile non unifiés, eux-mêmes consommés par 10+ écrans
```

Le point de rigidité principal n'est pas le moteur de dispo (déjà pensé multi-item) ni le service de réservation (déjà centralisé côté serveur), mais l'**absence de granularité** dans le modèle de données : une réservation ne peut référencer qu'une seule prestation, et une prestation ne peut avoir ni configuration (variantes/options) ni détail persistant au-delà du prix/durée. C'est exactement le trou que l'architecture cible doit combler sans casser ce qui fonctionne déjà.

---

## 2. Architecture cible

### 2.1 Principe directeur

**DECISION TECHNIQUE** — On introduit dès la V1 une table de jonction `reservation_items` (même si V1 n'autorise qu'un seul item par réservation au niveau produit). Cela évite exactement le piège identifié en §1.2 : ne jamais reproduire l'erreur actuelle où le multi-item existe en mémoire mais pas en persistance. Le schéma ci-dessous est conçu pour que V1 et V3 utilisent **la même table**, sans migration destructive entre les deux.

```
prestations (config, mutable, source vivante)
├── variant_groups (0..N)
│     └── variant_values (1..N par groupe)
├── options (0..N)
├── questions (0..N)                                    ← V2
└── ordering_rank (int)                                  ← V3, actif dès V1 (défaut suggéré, ajustable)

reservations (rendez-vous, 1 ligne, invariants globaux)
├── total_price, total_duration_minutes                  (dérivés, jamais saisis)
├── blocked_start_datetime, blocked_end_datetime
└── reservation_items (1..N, table de jonction — dès V1)
      ├── prestation_id (FK, nullable après suppression prestation)
      ├── snapshot_name, snapshot_price, snapshot_duration_minutes
      ├── position (= ordering_rank de la prestation au moment de la réservation, figé)
      ├── reservation_item_variants (0..N lignes, table normalisée)
      ├── reservation_item_options (0..N lignes, table normalisée)
      └── reservation_item_answers (0..N lignes, table normalisée)  ← V2
```

En V1, une réservation a toujours exactement une ligne dans `reservation_items`. Le code applicatif (backend et mobile) peut donc être écrit V1 en supposant `items[0]` sans jamais casser en V3 quand `items.length > 1` — c'est la garantie centrale demandée par le brief ("1 rendez-vous = 1 prestation, mais aussi plusieurs, sans casser le premier cas").

### 2.2 Pourquoi pas une évolution plus minimaliste (garder `prestation_id` sur `reservations` et ajouter les colonnes de variantes dessus) ?

**DECISION TECHNIQUE** — Rejetée. Elle referait exactement l'erreur qui existe déjà en V1 actuelle (§1.2) : le jour où V3 arrive, il faudrait migrer `reservations.prestation_id` + colonnes vers une table `reservation_items`, avec une migration de données non triviale sur des réservations historiques (l'exigence §16 interdit une migration destructive). Créer la table de jonction dès V1, même sous-utilisée, coûte une jointure de plus dans les requêtes de lecture mais élimine tout refactor de schéma en V3. C'est l'application directe de la consigne du brief : ne pas concevoir V1 comme une solution temporaire.

### 2.3 Configuration prestation (V1)

```
variant_groups
  id, prestation_id, name, required (bool), selection_mode ENUM('single','multi') DEFAULT 'single', sort_order

variant_values
  id, variant_group_id, label, price_delta, duration_delta, active, sort_order

options
  id, prestation_id, name, price_delta, duration_delta, active, sort_order
```

`prestations` gagne deux colonnes : `pricing_mode ENUM('fixed','from')` (défaut `'fixed'`, rétrocompatible — §6) et `ordering_rank INT` (défaut suggéré par catégorie, ajustable librement — §10).

### 2.4 Questions (V2)

```
questions
  id, prestation_id, label, type ENUM('short_text','long_text','boolean','single_choice','multi_choice'),
  required (bool), active (bool), is_sensitive (bool, défaut false), sort_order

question_choices
  id, question_id, label, sort_order
```

### 2.5 Détail de `reservation_items` (V1, extensible V2/V3)

```
reservation_items
  id, reservation_id, prestation_id (FK nullable),
  snapshot_name, snapshot_price, snapshot_duration_minutes,
  position (int, figé depuis ordering_rank au moment de la création)

reservation_item_variants
  id, reservation_item_id, variant_group_id (FK nullable), variant_value_id (FK nullable),
  snapshot_group_name, snapshot_value_label, snapshot_price_delta, snapshot_duration_delta

reservation_item_options
  id, reservation_item_id, option_id (FK nullable),
  snapshot_name, snapshot_price_delta, snapshot_duration_delta

reservation_item_answers                                  ← V2
  id, reservation_item_id, question_id (FK nullable),
  snapshot_question_label, snapshot_question_type, snapshot_is_sensitive,
  snapshot_choices_available (text[] ou table `reservation_item_answer_choices` si volumétrie le justifie),
  answer_value (text)
```

Chaque table de snapshot porte une FK **nullable** vers la table de config vivante (`variant_value_id`, `option_id`, `question_id`) — utile pour la navigation/les stats quand la config existe encore, jamais requise pour l'affichage historique (qui lit exclusivement les colonnes `snapshot_*`).

### 2.6 Ce que ce schéma permet sans refonte

- V1 : `reservation_items` a toujours 1 ligne, `reservation_item_variants`/`reservation_item_options` peuvent être vides tant que la prestation n'a pas de variante/option configurée (rétrocompatibilité, §16).
- V2 : ajout de `reservation_item_answers`, aucune migration de structure sur les tables V1.
- V3 : `reservation_items` accepte plusieurs lignes par `reservation_id`, `position` (dérivé de `ordering_rank`, §10) ordonne l'affichage, `reservations.total_price`/`total_duration_minutes` deviennent des agrégats calculés sur `SUM(reservation_items.snapshot_price)` au lieu d'être copiés d'une seule prestation.

---

## 3. Modèle de données — snapshot strategy (verrouillé : tables normalisées)

### 3.1 Ce qui doit être snapshoté (par élément de réservation)

D'après l'exigence du brief ("Pose Gel X / Longueur M / Forme Amande / Nail Art ne doit pas changer si la pro modifie la config après coup"), chaque `reservation_items` (+ ses tables filles) doit figer :

| Donnée | Où | Pourquoi la figer |
|---|---|---|
| `snapshot_name` | `reservation_items` | corrige le bug actuel (§1.2) où le nom n'est pas figé |
| `snapshot_price` | `reservation_items` | déjà figé actuellement (à conserver) |
| `snapshot_duration_minutes` | `reservation_items` | déjà figé actuellement (à conserver) |
| `snapshot_group_name`, `snapshot_value_label`, `snapshot_price_delta`, `snapshot_duration_delta` | `reservation_item_variants` | la cliente a choisi "Longueur M" — même si le groupe ou la valeur est renommé/supprimé ensuite, l'historique doit rester lisible |
| `snapshot_name`, `snapshot_price_delta`, `snapshot_duration_delta` | `reservation_item_options` | idem pour "Nail Art" |
| `snapshot_question_label`, `snapshot_question_type`, `snapshot_choices_available`, `answer_value` | `reservation_item_answers` (V2) | libellé de la question + choix disponibles au moment de la réponse + réponse donnée — nécessaire même si la question est supprimée ensuite |
| `variant_value_id`/`option_id`/`question_id` (FK nullable) | tables filles | garde un lien vers la config vivante **quand elle existe encore**, pour navigation/stats, jamais la source de vérité d'affichage d'un historique |

### 3.2 Comparaison JSONB vs tables normalisées — arbitrage rendu

| Critère | JSONB (rejeté) | Tables normalisées (retenu) |
|---|---|---|
| Requêtabilité stats (§19) | `jsonb ->>` operators, moins naturel | `JOIN`/`GROUP BY` SQL natif |
| Contrainte de forme | Validée uniquement côté application | Colonnes typées, contraintes DB (NOT NULL, CHECK) |
| Écriture | 1 `UPDATE` par item, tout en un | Plusieurs `INSERT` par item, dans la même transaction |
| Évolution du contenu snapshoté | Aucune migration nécessaire | Migration de schéma à chaque nouveau champ snapshoté |
| Lisibilité pour un futur dev/DBA | Structure implicite, à documenter à part | Structure explicite dans le schéma lui-même |

**DECISION PRODUIT (verrouillée)** — tables normalisées. Le critère décisif est la requêtabilité native pour les statistiques futures (§19) et la garantie de forme au niveau base de données plutôt qu'au niveau applicatif uniquement — cohérent avec l'exigence de fiabilité à long terme d'un historique de réservation. Le coût (plusieurs `INSERT` par item, migrations en cas d'évolution du contenu snapshoté) est accepté.

### 3.3 Ce qui ne doit PAS être snapshoté

Tout ce qui concerne la relation cliente/pro/statut/paiement reste au niveau `reservations` (pas dupliqué par item) : `client_id`, `pro_id`, `status`, `payment_status`, `deposit_amount`, `blocked_start_datetime`/`blocked_end_datetime`, `timezone`. Ces champs concernent le rendez-vous dans son ensemble, pas une prestation individuelle.

### 3.4 Correction du bug existant

**DECISION TECHNIQUE** — Ajouter `snapshot_name` à `reservation_items` corrige au passage la faille identifiée en §1.9/1.2 (nom non figé). Ce correctif est un sous-produit naturel de la migration V1, pas un chantier séparé.

---

## 4. Flux de réservation

### 4.1 Création (V1, cible)

1. Cliente sélectionne une prestation → mobile affiche `pricing_mode`, groupes de variantes (sélection unique par groupe), options (sélection multiple).
2. Mobile calcule un prix/durée **indicatif** pour l'affichage instantané (UX réactive), mais ne l'envoie jamais comme vérité — cf. §5.
3. Cliente confirme sa config → mobile envoie au backend : `prestation_id`, `selected_variant_value_ids[]` (un par groupe obligatoire), `selected_option_ids[]`.
4. Backend (nouveau, dans `reservation.service.ts` étendu) : relit la prestation + variantes + options **actives** en base, valide la combinaison (groupe requis rempli, valeurs/options actives, pas de doublon, **aucun total négatif possible** — §5.3), calcule `price`/`duration` par la formule du §5, insère les lignes de snapshot normalisées, calcule le créneau bloqué (buffers), insère `reservations` + `reservation_items` (+ tables filles) dans la **même transaction** déjà en place (`withProReservationLock`).
5. Notification post-commit inchangée.

Le flux reprend explicitement les 6 étapes déjà listées au §11 du brief et déjà globalement respectées par le code actuel (§1.4) — la nouveauté est l'insertion d'une étape de validation de configuration avant le calcul.

### 4.2 Modification côté pro (walk-in / téléphone)

Même service `createReservation`, extension naturelle : le formulaire pro (`NewAppointmentSheet.tsx`) doit lui aussi proposer variantes/options, pas seulement le prix brut de la prestation.

---

## 5. Pricing engine

### 5.1 Formule (par élément)

```
prix_final(item)   = prestation.price
                    + Σ variant_values.price_delta (une valeur par groupe sélectionné)
                    + Σ options.price_delta (options sélectionnées)

durée_finale(item) = prestation.duration_minutes
                    + Σ variant_values.duration_delta
                    + Σ options.duration_delta
```

### 5.2 Formule (par réservation, V3)

```
total_price    = Σ prix_final(item) pour chaque item, trié par ordering_rank (§10)
total_duration = Σ durée_finale(item) pour chaque item
```

Le calcul du créneau bloqué (buffers) **réutilise tel quel** `resolveServiceBlocking()` (§1.3) : cette fonction est déjà écrite pour recevoir plusieurs "durées à bloquer" et appliquer buffer avant = premier item, buffer après = dernier item, buffers intermédiaires cumulés. Il suffit de lui passer `durée_finale(item)` au lieu de `duration_minutes` brut, dans l'ordre défini par `ordering_rank`.

**DECISION TECHNIQUE** — Le calcul est fait **uniquement côté backend**, jamais accepté depuis le client (cohérent avec l'existant, §1.5, où `price` envoyé par le client est déjà ignoré). Le mobile calcule un montant indicatif pour l'UX mais le serveur est la seule source de vérité — pas de nouvelle divergence à gérer.

### 5.3 Cas limites du calcul

- **Prix négatif — verrouillé : blocage, pas de correction silencieuse.** Un `price_delta` négatif reste légitime au niveau d'une valeur/option isolée (ex. option "sans French" -5€), mais si une combinaison choisie par la cliente aboutit à un `prix_final(item) < 0`, le backend **rejette la réservation en 422** avec un message explicite, plutôt que de corriger silencieusement à 0. Complément **DECISION TECHNIQUE** : pour éviter qu'une cliente se heurte à ce rejet en usage normal, la validation à l'écriture côté pro (formulaire de configuration) doit elle-même empêcher d'enregistrer/activer une configuration dont la pire combinaison légale (tous les deltas négatifs actifs cumulés sur un groupe obligatoire + toutes les options à delta négatif) rendrait le prix minimal négatif — calcul fait à la sauvegarde de la prestation, pas seulement à la réservation. Le 422 en réservation devient alors un filet de sécurité pour les cas où la validation d'écriture aurait été contournée (ex. donnée modifiée hors du formulaire), pas le mécanisme principal.
- **Durée négative** : même traitement — blocage à l'écriture si la pire combinaison légale aboutit à une durée finale non strictement positive (pas de clamp automatique à une valeur minimale arbitraire, cohérent avec la décision sur le prix).
- **Option/variante inactive au moment de la sélection** : le backend revalide `active=true` au moment de la création (pas seulement au chargement de l'écran mobile, qui peut être en cache) → 422 si une valeur choisie n'est plus active, avec message clair pour forcer un rafraîchissement mobile.
- **Groupe requis sans valeur active** : cas de configuration pro invalide — la prestation ne doit pas apparaître comme réservable en ligne tant qu'un groupe obligatoire n'a aucune valeur active. **DECISION TECHNIQUE** — validation à l'écriture côté formulaire pro (bloquer la sauvegarde/activation d'un groupe requis vide), pas seulement à la réservation.
- **Valeurs supprimées** : cf. §16 rétrocompatibilité — pas de suppression physique en V1, seulement désactivation (`active=false`), cohérent avec le principe déjà appliqué aux prestations (§1.8).
- **Combinaison invalide** (ex. deux valeurs du même groupe envoyées) : rejet 422 par le backend, validation Zod stricte (un `variant_value_id` par `variant_group_id` distinct).

---

## 6. Pricing mode « à partir de » (verrouillé)

### 6.1 Valeur affichée dans la liste des prestations

**DECISION PRODUIT (verrouillée)** : `prix_affiché_liste = prestation.price` quand `pricing_mode='fixed'` ; quand `pricing_mode='from'`, `prix_affiché_liste = prestation.price + Σ min(price_delta) par groupe obligatoire` (les options, facultatives par nature, n'y participent jamais, ni les groupes facultatifs). C'est le prix plancher réellement atteignable, jamais un prix théorique non réservable — y compris quand tous les deltas d'un groupe obligatoire sont positifs : dans ce cas le "à partir de" intègre bien le `min(delta)` positif, pas le prix de base seul.

### 6.2 Affichage côté cliente (avant configuration)

Écran `ServiceSelector` : afficher `"À partir de {prix_plancher} €"` si `pricing_mode='from'`, sinon `"{price} €"` brut — changement minimal sur un composant déjà identifié (§1.10, `ServiceSelector.tsx:156-166`).

### 6.3 Affichage du prix final après configuration

Une fois variantes/options sélectionnées, on affiche toujours le **prix exact calculé** (§5.1), plus de "à partir de" — le mode `from` ne s'applique qu'à l'affichage catalogue, jamais au récapitulatif de réservation qui doit montrer un montant ferme.

### 6.4 « From » sans variante configurée

Si `pricing_mode='from'` mais qu'aucun groupe de variante n'existe encore (pro qui vient de cocher le mode sans avoir créé de groupes) : le prix affiché est identique au prix fixe (`prestation.price`), sans mention "à partir de" trompeuse.
**DECISION TECHNIQUE** — n'afficher "à partir de" que si au moins un groupe obligatoire actif existe avec au moins une valeur dont le `price_delta` diffère de 0 ; sinon traiter l'affichage comme `fixed` même si la colonne `pricing_mode` vaut `'from'`. Évite d'exposer un mode mal configuré.

### 6.5 « From » avec variantes ET options

**DECISION PRODUIT (verrouillée)** : les options ne participent jamais au calcul du "à partir de" (§6.1). Les groupes de variantes **facultatifs**, même avec un `price_delta` positif, n'y participent pas non plus — seuls les groupes **obligatoires** influencent le prix plancher affiché en liste, pour la même raison de cohérence : un élément que la cliente peut choisir de ne pas prendre ne peut pas faire partie d'un minimum garanti.

---

## 7. Variantes (verrouillé)

Schéma déjà posé en §2.3. Un groupe = nom, `required`, `selection_mode`, `sort_order`. Une valeur = label, `price_delta`, `duration_delta`, `active`, `sort_order`.

### 7.1 Sélection unique vs multiple par groupe

**DECISION PRODUIT (verrouillée)** — pas de cas métier identifié aujourd'hui justifiant la sélection multiple dans un même groupe. `variant_groups.selection_mode ENUM('single','multi')` reste modélisé dans le schéma dès V1 (coût nul : une colonne ENUM avec défaut `'single'`) pour rester compatible sans migration si un besoin apparaît plus tard, mais **l'UI et la validation V1 n'implémentent que le mode `single`** — le comportement `multi` n'est pas construit tant qu'aucun besoin concret ne le justifie.

---

## 8. Options (verrouillé)

Schéma posé en §2.3. Contrairement aux variantes, sélection multiple par nature (cf. brief), pas de `selection_mode` nécessaire — un ensemble d'options cochées/décochées indépendamment.

Recalcul du total : réutilise la même formule §5.1, addition simple des `price_delta`/`duration_delta` des options cochées.

**DECISION PRODUIT (verrouillée)** — aucune règle d'exclusion mutuelle entre options en V1. Si un besoin apparaît plus tard, une table `option_exclusions` ou un champ `excludes_option_ids[]` s'ajoute sans impact sur le schéma déjà posé.

---

## 9. Questions (préparation V2)

Schéma posé en §2.4. Types envisagés couverts sans ambiguïté par l'ENUM proposé.

### 9.1 Snapshot

`reservation_item_answers` (§2.5) : pour chaque réponse, figer `snapshot_question_label`, `snapshot_question_type`, `snapshot_is_sensitive`, `snapshot_choices_available`, `answer_value`. Cohérent avec le principe du §3.1 : la question peut être supprimée ou modifiée après coup, la réponse historique doit rester lisible avec son contexte d'origine — y compris son statut "sensible" au moment de la réponse, nécessaire pour appliquer la bonne politique de rétention même si la question change de statut ensuite.

### 9.2 Données sensibles (santé/allergies) — garde-fou verrouillé

L'audit mobile confirme qu'**aucune infrastructure de questions structurées n'existe aujourd'hui** : le seul point de contact avec une donnée santé est le champ libre `allergies` sur `ClientNote` (`lib/api.ts:149-161`), rempli manuellement par la pro **après** le rendez-vous, non lié à une prestation, non versionné. Le seul "canal" actuel dans le flux de réservation est un bouton de message libre vers la pro (`BookingSummary.tsx:225-240`) — aucun champ structuré actuellement collecté au moment de la réservation.

**DECISION PRODUIT (verrouillée)** — mécanisme à deux niveaux :
1. `questions.is_sensitive BOOLEAN DEFAULT false`, coché explicitement par la pro à la création d'une question ("cette question porte sur une donnée de santé/particulière").
2. **Détection assistée par mots-clés** : à la saisie du libellé (`server.ts` ou service dédié `prestation-config.service.ts`), une liste de termes évocateurs (allergie, santé, grossesse, médical, maladie, traitement — liste à constituer et maintenir) déclenche une **suggestion** du flag `is_sensitive`, que la pro confirme ou infirme explicitement avant sauvegarde. La détection n'est jamais bloquante ni automatique seule — elle assiste la pro à ne pas rater une question sensible créée sans le savoir, sans lui retirer la décision finale.

Quand `is_sensitive=true` :
- Le flux de réservation affiche un **texte de consentement explicite dédié**, distinct du consentement générique CGU, avant que la cliente puisse répondre.
- `reservation_item_answers.snapshot_is_sensitive=true` déclenche une politique de rétention spécifique (cf. `backend/cron/data-retention.ts`, déjà existant pour d'autres données — à étendre, pas à réinventer).

**QUESTION À VALIDER (restante, juridique)** — la liste de mots-clés déclenchant la suggestion et le texte exact du consentement dédié doivent être rédigés/validés avec un regard juridique avant mise en prod (contenu, pas architecture) ; ceci ne bloque pas le développement du mécanisme technique (flag + UI de consentement + rétention), qui peut être construit avec une liste de mots-clés provisoire et un texte de consentement générique à affiner ensuite.

---

## 10. V3 — Multi-prestations (ordre verrouillé : `ordering_rank`)

Le schéma §2.1 est déjà conçu pour ce cas : `reservation_items` accepte nativement 1..N lignes par réservation. Le passage V1→V3 ne change **aucune structure**, seulement les règles d'usage :

- **Ordre** — **DECISION PRODUIT (verrouillée)** : `prestations.ordering_rank INT`, des catégories/rangs par défaut proposés (ex. Retrait/Dépose=0, Soin=10, Pose=20, Finition=30, ajustables), la pro peut modifier le rang de chacune de ses prestations librement. Le panier V3 se trie automatiquement par `ordering_rank` croissant avant le calcul final (buffers, snapshot) — pas de contraintes pair-à-pair, pas de détection de cycles. `reservation_items.position` fige ce rang au moment de la réservation (le rang vivant peut changer ensuite sans affecter l'historique, même logique que les autres champs snapshotés).
- **Création** : le flux §4.1 boucle sur N prestations **triées par `ordering_rank`** au lieu d'une seule ; `resolveServiceBlocking()` (déjà multi-item, §1.3) calcule le blocage global dans cet ordre.
- **Modification** : ajouter/retirer un item d'une réservation existante avant confirmation = ajout/suppression de lignes `reservation_items` + recalcul `total_price`/`total_duration`. Après confirmation, cf. règle reschedule §12.
- **Annulation** : au niveau `reservations` (statut global), pas par item — annuler un item seul reviendrait à une modification de config post-confirmation (cf. §12 cas B), pas une annulation.
- **Déplacement** : cf. §12.
- **Affichage** : récapitulatif = liste des items dans l'ordre de `position`, avec leurs snapshots individuels + total en bas — extension directe de `BookingSummary.tsx` et `booking/[id].tsx`, qui affichent aujourd'hui un seul bloc prestation.
- **Historique** : même table, une réservation à 3 items s'affiche comme 3 lignes détaillées ordonnées sous un même rendez-vous — corrige au passage le vide fonctionnel identifié en §1.9 (absence d'historique détaillé côté client-detail.tsx), qui devient nécessaire dès lors qu'un RDV peut contenir plusieurs prestations.
- **Statistiques futures** : cf. §19 — `reservation_items` est l'unité d'agrégation naturelle (par prestation, par variante, par option), la table `reservations` reste l'unité d'agrégation pour le panier moyen / CA global.

---

## 11. Calendrier / disponibilité — cohérence avec le principe existant

Le moteur de dispo actuel applique déjà exactement le principe demandé au §10 du brief : les colonnes `blocked_start_datetime`/`blocked_end_datetime` sont écrites une fois à la création et jamais relues depuis la config vivante (§1.2, §1.3). **Aucun changement de principe n'est nécessaire** — uniquement une extension pour que le calcul source (durée finale par item, ordonnée par `ordering_rank`, §5/§10) alimente `resolveServiceBlocking()` au lieu de la durée brute de prestation.

Séquence de création (déjà globalement conforme, §1.4), ordre à préserver explicitement :
1. Résoudre la configuration de chaque prestation demandée (variantes + options sélectionnées, validées actives), triées par `ordering_rank`.
2. Calculer prix + durée par item (§5.1) puis total (§5.2), avec blocage si négatif (§5.3).
3. Déterminer les buffers (réutilise `resolveServiceBlocking`, inchangé dans son algorithme).
4. Calculer le créneau bloqué.
5. Snapshotter (prestation + variantes + options + réponses le cas échéant) dans `reservation_items` et tables filles normalisées, agrégats dans `reservations`.
6. Transaction unique (réutilise `withProReservationLock`, inchangé).

---

## 12. Reschedule

### 12.1 Cas A — déplacement simple (date/heure uniquement)

**DECISION TECHNIQUE** — conserver `reservation_items` et tous les snapshots à l'identique ; recalculer uniquement `blocked_start_datetime`/`blocked_end_datetime` à partir de la **durée totale déjà snapshotée** (`Σ reservation_items.snapshot_duration_minutes` + règles de buffers déjà figées). C'est exactement le comportement déjà implémenté aujourd'hui côté self-service (`app/(client)/bookings.tsx`, §1.6) — à généraliser au multi-item sans changer la logique.

### 12.2 Cas B — modification explicite de configuration

**DECISION TECHNIQUE** — traité comme une **nouvelle transaction de recalcul**, pas comme un simple déplacement : le backend revalide la configuration actuelle des prestations/variantes/options demandées (elles peuvent avoir changé depuis la réservation initiale), recalcule prix/durée par la formule §5 (avec blocage si négatif, §5.3), régénère les lignes de snapshot normalisées, recalcule le créneau bloqué en conséquence. Réutilise la même mécanique que la création initiale (§4.1), pas un chemin de code séparé — seule différence : `DELETE`+`INSERT` sur `reservation_items`/tables filles existants plutôt qu'un `INSERT` initial, dans la même transaction verrouillée.

### 12.3 Impact technique

Le point de bascule (§1.6, déjà identifié) où `proposed_prestation_id`/`proposed_price` existent côté API pro-initiated reschedule mais sans UI mobile correspondante devient le premier terrain d'application concret du Cas B — corriger cet écart fait partie naturelle du chantier V1/V2, pas un ticket séparé.

---

## 13. API

### 13.1 V1

| Endpoint | Méthode | Scope | Note |
|---|---|---|---|
| `/api/pro/prestations/:id/variant-groups` | POST/GET | pro, ownership vérifié | création/listing groupes |
| `/api/pro/prestations/:id/variant-groups/:groupId` | PATCH/DELETE | pro | modification/désactivation (pas de hard delete si valeurs référencées par une réservation) |
| `/api/pro/variant-groups/:groupId/values` | POST/GET | pro | valeurs d'un groupe |
| `/api/pro/variant-values/:id` | PATCH/DELETE | pro | idem — désactivation, pas de suppression physique si utilisé |
| `/api/pro/prestations/:id/options` | POST/GET | pro | |
| `/api/pro/options/:id` | PATCH/DELETE | pro | |
| `/api/pro/prestations/:id` | PATCH (étendu) | pro | ajoute `pricing_mode`, `ordering_rank` aux champs modifiables existants |
| `/api/reservations` (existant, étendu) | POST | client | body étendu : `selected_variant_value_ids[]`, `selected_option_ids[]` par prestation |

### 13.2 V2

| Endpoint | Méthode | Scope |
|---|---|---|
| `/api/pro/prestations/:id/questions` | POST/GET | pro |
| `/api/pro/questions/:id` | PATCH/DELETE | pro |
| `/api/pro/questions/:id/choices` | POST/GET | pro |
| réservation (étendu) | POST | client, `answers[]` par question |

### 13.3 V3

| Endpoint | Méthode | Scope |
|---|---|---|
| `/api/reservations` (étendu) | POST | client, `items: [{prestation_id, variant_value_ids[], option_ids[], answers[]}]` au lieu d'un `prestation_id` unique, triés serveur par `ordering_rank` |
| `/api/pro/appointments` (étendu) | POST/PATCH | pro, même extension |

### 13.4 Vérifications transverses (toutes versions)

- **Authentification** : réutilise `authMiddleware`/`authenticateToken` (JWT cookie/header, existant, §1 audit backend) sans changement.
- **Autorisation** : chaque route pro re-filtre systématiquement par `pro_id` du token (pattern déjà appliqué partout, §1 audit backend) — appliqué identiquement aux nouvelles tables (`variant_groups.prestation_id → prestations.pro_id`).
- **Validation Zod** : nouveaux schémas dans `middleware/validate.ts`, même convention que l'existant (`prestationSchema`, `reservationSchema`) — `variantGroupSchema`, `variantValueSchema`, `optionSchema`, `questionSchema`, `questionChoiceSchema`.
- **Transaction** : la création/modification de réservation reste dans `withProReservationLock` existant (§1.4) — aucune nouvelle primitive de concurrence nécessaire, le verrou advisory par `pro_id` couvre déjà le cas multi-item.
- **Erreurs** : 422 pour combinaison invalide/inactive/prix-durée négatif (§5.3), 409 pour conflit de créneau (déjà en place), 403/401 inchangés.
- **Concurrence** : le verrou advisory existant (`RESERVATION_LOCK_NS` + `pro_id`) protège déjà la création contre le double-booking, y compris multi-item, sans changement de granularité — pas besoin d'un verrou par prestation individuelle puisque le blocage se fait au niveau du créneau du pro.
- **Idempotence** : les endpoints de CRUD config (variantes/options/questions) sont naturellement idempotents pour PATCH/DELETE (existant). Pour la création de réservation, le comportement actuel (pas de clé d'idempotence explicite, protégé par le verrou + la vérification de conflit) est conservé à l'identique — **hors scope** de ce chantier.

---

## 14. Mobile

### 14.1 Pro — organisation UX proposée

`service-form.tsx` (aujourd'hui un formulaire plat, §1 audit mobile) devient un écran avec sections dépliables, à la suite des champs existants (nom/description/prix/durée/buffers/actif) :
- Section **Pricing mode** : toggle `fixed`/`from` (nouveau champ, aucun champ existant supprimé).
- Section **Ordre dans un RDV multi-prestations** (V3, champ existant dès V1) : sélecteur de catégorie/rang suggéré (`ordering_rank`), avec ajustement libre.
- Section **Variantes** : liste de groupes, chacun avec ses valeurs — CRUD inline ou sous-écran dédié selon la profondeur (recommandation : sous-écran, pour éviter un formulaire à profondeur 3 sur mobile).
- Section **Options** : liste plate, CRUD inline (moins de profondeur que les variantes).
- Section **Questions** (V2) : liste, CRUD inline pour le libellé/type, avec suggestion de flag `is_sensitive` à la saisie (§9.2), sous-écran pour les choix si `single_choice`/`multi_choice`.

`services.tsx` (liste) : aucun changement structurel, la duplication (§1.7, déjà présente) doit être corrigée pour copier aussi variantes/options/questions (§17) — bug de duplication incomplète déjà existant à corriger dans le même chantier.

### 14.2 Cliente — organisation UX proposée

`app/booking.tsx`, étape 1 (`ServiceSelector`) : après sélection de la prestation, si elle a des groupes de variantes/options, insérer une **sous-étape de configuration** avant l'étape date/heure actuelle (pas une refonte des 4 étapes existantes, une étape 1bis conditionnelle) :
- groupes de variantes obligatoires en premier (radio ou chips, sélection unique en V1),
- options ensuite (checkboxes, sélection multiple),
- questions en V2 (formulaire dynamique selon `type`, texte de consentement dédié si `is_sensitive`),
- prix/durée recalculés en direct à l'affichage (indicatif, §5.2) pendant la configuration.

`BookingSummary.tsx` (étape 3 existante) : le récapitulatif doit lister variantes/options/réponses choisies sous le nom de la prestation, pas seulement le nom+prix actuels.

### 14.3 V3 — sélection multi-prestations

**DECISION PRODUIT (verrouillée)** — extension de l'étape 1 : passage d'une sélection unique (`selectedId: number | null`, §1 audit mobile) à une sélection multiple (panier de prestations), chacune configurable indépendamment (sa propre sous-étape de variantes/options/questions), avant de passer à la sélection de créneau globale. L'ordre d'affichage/exécution est **automatique**, dérivé du `ordering_rank` de chaque prestation (§10) — pas de réordonnancement manuel dans l'UI cliente en V3 initiale. Le récapitulatif liste chaque prestation dans cet ordre avec son propre bloc de détail, total consolidé en bas — extension du même composant `BookingSummary.tsx`.

---

## 15. TypeScript — source de vérité commune

### 15.1 Constat (détaillé en §1.10)

Au moins 3 définitions divergentes de `Service`/`Prestation`, au moins 4 de `Booking`/réservation, réparties sur `services.tsx`, `service-form.tsx`, `public-profile.tsx`, `ServiceSelector.tsx`, `NewAppointmentSheet.tsx`, `booking/[id].tsx`, `(client)/bookings.tsx`, `BookingCard.tsx`, `(client)/index.tsx`, plus deux définitions dans les tests.

### 15.2 Proposition

**DECISION TECHNIQUE** — créer `types/prestation.ts` et `types/reservation.ts` (ou `lib/types/`, à aligner sur la convention `lib/` déjà utilisée pour les autres modules partagés du repo mobile) comme source unique, avec les types suivants dès V1 (certains inertes tant que V2/V3 ne sont pas développées, mais définis dès maintenant pour que chaque écran migre une fois vers la forme finale plutôt que deux fois) :

```ts
Prestation, VariantGroup, VariantValue, Option
Question, QuestionChoice                    // V2, champs optionnels tant que V2 n'existe pas côté backend
ReservationItem, ReservationSelection       // sélection = ce que la cliente choisit en formulaire
ReservationAnswer                           // V2
```

Migration des écrans existants vers ces types : **progressive, pas un big-bang** — chaque écran listé en §1.10 migre au moment où il est de toute façon modifié pour supporter variantes/options (§14), pas dans une PR de renommage séparée. Ceci évite un chantier de refactor pur sans valeur produit immédiate, cohérent avec le principe général du projet ("pas de renommage sans besoin").

---

## 16. Rétrocompatibilité

### 16.1 Prestation sans variante/option/question

Le schéma (§2) rend cela natif : `variant_groups`/`options`/`questions` sont des tables **séparées**, référencées par FK vers `prestations`, jamais des colonnes ajoutées à `prestations` elle-même. Une prestation existante aujourd'hui a simplement zéro ligne dans ces tables — comportement V1 = comportement actuel à l'identique, aucune migration de données sur `prestations` autre que l'ajout des colonnes `pricing_mode`/`ordering_rank` (nullable/défaut, non bloquantes).

### 16.2 Réservation existante

Les réservations déjà créées (colonnes `reservations.prestation_id`/`price`/`duration...` existantes, §1.2) continuent de fonctionner sans modification. **DECISION TECHNIQUE** — migration de backfill non destructive : pour chaque réservation existante, créer une ligne `reservation_items` correspondante avec `snapshot_name/price/duration` recopiés depuis les colonnes actuelles de `reservations` (le nom recopié au backfill sera celui **actuel** de la prestation, puisque l'historique n'a jamais figé le nom avant ce chantier — limite acceptée et documentée, pas de perte de donnée puisque cette information n'existait pas). Cette approche suit exactement le pattern déjà utilisé par la migration `20260902000001_availability_engine.sql:170-189` (backfill idempotent, `WHERE ... IS NULL`, sur les réservations existantes) — convention du repo à réutiliser, pas à réinventer.

### 16.3 Colonnes `reservations` existantes — verrouillé : dual-write indéfini

**DECISION PRODUIT (verrouillée)** — à partir de V1, `reservation_items` (+ tables filles) devient la **source de vérité fonctionnelle** pour tout nouveau code métier (calcul, affichage, statistiques). Les colonnes legacy de `reservations` (`prestation_id`, `price`, `service_duration_minutes`, etc.) restent **alimentées en parallèle** (dual-write) pour compatibilité descendante avec d'éventuels anciens builds mobiles, **sans qu'aucun nouveau code ne dépende de leur lecture**. Aucune date de suppression n'est fixée maintenant — le drop sera un chantier de cleanup séparé, décidé une fois confirmé qu'aucun code actif (mobile ou backend) ne les lit plus, sur le même modèle que la dépréciation de `slot_id` (`20260904000002_drop_reservations_slot_id.sql` / `20260913000001_drop_slots_table.sql`).

Point de vigilance à documenter dans le code (commentaire sur les colonnes legacy) : `reservation_items` fait foi en cas de divergence — le dual-write doit toujours écrire `reservation_items` en premier dans la transaction, les colonnes legacy en dérivé (copie de `reservation_items[0]` quand un seul item, `total_price`/`total_duration` quand plusieurs), jamais l'inverse.

---

## 17. Duplication

Conformément au brief : dupliquer une prestation doit copier toute sa configuration (groupes, valeurs, options, questions, choix) mais **jamais** de donnée de réservation.

**DECISION TECHNIQUE** — corriger dans le même chantier le bug déjà identifié (§1.7) : la duplication actuelle omet déjà `buffer_before/after_minutes`, `preparation_instructions`, `recall_weeks`, `booking_lead_time/horizon_days`, `is_online_bookable`. La nouvelle implémentation de `duplicate()` doit copier l'intégralité des colonnes de `prestations` (buffers, `pricing_mode`, `ordering_rank` inclus) **et** cascader sur `variant_groups`→`variant_values`, `options`, `questions`→`question_choices`, chacun avec de nouveaux IDs (pas de partage de FK entre l'original et la copie — sinon désactiver une valeur sur l'original désactiverait aussi la copie). La prestation dupliquée reste `active=false` (comportement existant conservé).

---

## 18. Edge cases

| Cas | Comportement proposé |
|---|---|
| Prestation désactivée alors qu'une réservation existe | Déjà géré aujourd'hui par le principe `active` sans suppression (§1.8) — le snapshot garantit que la réservation reste affichable même si la prestation source est inactive. Inchangé. |
| Option/variante désactivée après réservation | Tables de snapshot normalisées (§3) préservent l'affichage historique intact ; la désactivation empêche seulement de nouvelles sélections. |
| Question supprimée après réponse | `reservation_item_answers` conserve libellé/type/choix/sensibilité au moment de la réponse (§9.1) — suppression logique uniquement (`active=false`), pas de hard delete si des réponses existent (même pattern FK-protégée que §1.8). |
| Modification de prix/durée | N'affecte jamais une réservation existante (snapshot déjà figé) ; s'applique aux réservations futures dès la prochaine sélection. |
| Suppression d'une valeur/option | Pas de hard delete si référencée par un `reservation_item_variants`/`reservation_item_options` (contrainte FK naturelle sur tables normalisées, plus stricte qu'un JSONB) — une valeur ne peut être que désactivée, jamais hard-deleted si elle existe dans un snapshot (cohérence avec le principe déjà appliqué aux prestations). |
| Prix final à zéro | Autorisé (ex. option de compensation qui ramène exactement à 0) — pas bloquant, juste affiché "Gratuit". |
| Prix/durée négatifs | **Bloqué**, pas corrigé silencieusement (§5.3) — validation à l'écriture de la config pro (pire combinaison légale ≥ 0) + 422 en filet de sécurité à la réservation. |
| Groupe requis sans valeur active | Bloque la publication/activation de la prestation en ligne (validation à l'écriture, §5.3), pas seulement à la réservation. |
| Option sélectionnée deux fois | Validation Zod : dédoublonnage silencieux côté backend (idempotent), plus simple et sans impact UX négatif qu'un rejet pur. |
| Valeur de variante provenant de deux groupes différents envoyée pour un seul groupe | 422, validation stricte un `variant_value_id` par `variant_group_id` (§5.3). |
| Modification concurrente de configuration (pro édite pendant qu'une cliente réserve) | Le backend revalide toujours la configuration **au moment de l'écriture** (§4.1 étape 4), jamais celle lue en mémoire côté mobile — la cliente peut recevoir un 422 si une valeur vient d'être désactivée, avec message de rafraîchissement. Pas de verrou optimiste supplémentaire nécessaire, le pattern existant (revalidation serveur systématique) suffit. |
| Réservation concurrente du même créneau | Couvert par le verrou advisory existant (§13.4), inchangé pour le multi-item. |
| Modification d'un rendez-vous existant | Cf. §12 (cas A/B reschedule). |
| Annulation | Au niveau réservation globale, inchangé (§10). |
| Duplication | Cf. §17. |
| Ancienne réservation sans configuration (pré-migration) | Backfill §16.2 lui donne un `reservation_items` avec tables filles vides sur variantes/options/réponses — affichage identique à une prestation simple V1, cohérent. |
| Prestation supprimée | Hard delete déjà bloqué par FK si réservations existantes (§1.8) — comportement conservé, `reservation_items.prestation_id` devient `NULL` uniquement dans le cas où la suppression est un jour autorisée après une période de rétention (hors scope V1-V3, purge RGPD éventuelle à traiter comme un chantier séparé). |
| Pro inactive / abonnement inactif | Guards déjà en place (`requireActiveProSubscription`, `requirePlan`/`PLAN_RANK`, §1 audit backend) s'appliquent aux nouvelles routes de configuration (variantes/options/questions) de la même façon qu'aux routes prestations existantes — pas de nouveau mécanisme, extension du gating existant. |

---

## 19. Statistiques futures (vérification architecturale, non développée)

Le modèle proposé (tables normalisées, §3.2) permet nativement, sans changement structurel supplémentaire, en **SQL natif** (`JOIN`/`GROUP BY`, sans opérateurs JSON) :
- **CA/nombre de réservations par prestation** : `GROUP BY reservation_items.prestation_id`.
- **CA par variante / popularité des options** : `GROUP BY reservation_item_variants.variant_value_id` / `reservation_item_options.option_id` (ou sur les colonnes `snapshot_*` pour inclure les valeurs supprimées depuis).
- **Durée moyenne / panier moyen** : agrégats sur `reservation_items.snapshot_duration_minutes`/`snapshot_price` (par item) et `reservations.total_price`/`total_duration_minutes` (par RDV).
- **Prestations combinées (V3)** : `reservation_items` groupées par `reservation_id`, analyse de cooccurrence directe via self-join.
- **Taux d'utilisation des options** : `COUNT` sur présence dans `reservation_item_options` / `COUNT` total de réservations de la prestation.

Aucune table dédiée aux statistiques n'est nécessaire à ce stade — cohérent avec la consigne du brief de ne pas développer cette partie sauf nécessité architecturale (il n'y en a pas : le schéma normalisé suffit, et sert mieux ce besoin que l'option JSONB initialement envisagée).

---

## 20. Roadmap V1 / V2 / V3

### V1 — Prestations configurables + pricing mode + variantes + options + snapshot

- **Migrations** : `pricing_mode`, `ordering_rank` sur `prestations` ; tables `variant_groups`, `variant_values`, `options` ; tables `reservation_items`, `reservation_item_variants`, `reservation_item_options` ; backfill non destructif des réservations existantes (§16.2).
- **Backend** : nouveau service `prestation-config.service.ts` (variantes/options, CRUD scopé pro, validation "pire combinaison ≥ 0" à l'écriture §5.3) ; extension de `reservation.service.ts` (validation config, calcul §5, écriture `reservation_items` + tables filles, dual-write des colonnes legacy §16.3) ; extension `resolveServiceBlocking` pour consommer les durées finales calculées ; nouveaux schémas Zod ; correction bug duplication (§17) et bug nom non snapshoté (§3.4).
- **Mobile pro** : extension `service-form.tsx` (pricing mode, ordering_rank, sections variantes/options) ; correction affichage duplication.
- **Mobile cliente** : sous-étape de configuration dans `booking.tsx` ; extension `BookingSummary.tsx` ; extension `ServiceSelector.tsx` pour l'affichage "à partir de".
- **Tests** : cf. §21, Tests 1-3 + tests de non-régression sur la création simple existante.
- **Dépendances** : aucune dépendance externe nouvelle, extension de l'existant.
- **Risques** : régression sur le flux de réservation actuel si la revalidation serveur (§5.3) est trop stricte pour des cas déjà en prod (ex. prestations existantes sans aucune variante — doit passer par le même chemin de code sans erreur, cf. Test 1 §21).
- **Critères de sortie** : Test 1 (comportement actuel identique) au vert, aucune régression sur `booking-flow.test.ts`/`booking-calculations.test.ts` existants, duplication corrigée et testée, aucune configuration pro permettant un prix/durée négatif ne peut être sauvegardée.

### V2 — Questions + réponses + snapshot

- **Migrations** : tables `questions` (avec `is_sensitive`), `question_choices` ; table `reservation_item_answers`.
- **Backend** : CRUD questions/choix scopé pro, détection assistée par mots-clés à la création (§9.2, liste provisoire acceptable au départ) ; extension validation réservation (réponses requises/facultatives, consentement dédié si sensible) ; politique de rétention étendue (`backend/cron/data-retention.ts`) pour les réponses `is_sensitive`.
- **Mobile pro** : section Questions dans `service-form.tsx`, avec confirmation du flag `is_sensitive` suggéré.
- **Mobile cliente** : formulaire dynamique par type de question dans la sous-étape de configuration, texte de consentement dédié si sensible.
- **Tests** : cf. §21.
- **Dépendances** : texte de consentement/liste de mots-clés définitifs à valider avec un regard juridique avant mise en prod (n'empêche pas le développement du mécanisme, §9.2).
- **Risques** : le principal risque reste de conformité si le mécanisme de suggestion/consentement n'est pas correctement branché sur tous les points d'entrée (création de question ET affichage cliente).
- **Critères de sortie** : snapshot de réponse démontré immuable après suppression de la question source (Test dédié), consentement dédié affiché systématiquement pour toute question `is_sensitive`, rétention spécifique vérifiée.

### V3 — Multi-prestations

- **Migrations** : aucune nouvelle table (`reservation_items` déjà multi-lignes depuis V1) — seulement suppression de la contrainte implicite "1 item par réservation" côté validation applicative (pas de contrainte SQL à lever, elle n'a jamais existé au niveau du schéma).
- **Backend** : `reservation.service.ts` boucle sur `items[]` triés par `ordering_rank` au lieu de `items[0]` implicite ; `resolveServiceBlocking` déjà prêt (§1.3) ; ajustement des endpoints (§13.3).
- **Mobile pro** : `NewAppointmentSheet.tsx` passe en sélection multiple.
- **Mobile cliente** : refonte de l'étape 1 en panier multi-prestations, ordre automatique par `ordering_rank` (§14.3) ; refonte de l'historique côté `client-detail.tsx` (comble le vide identifié en §1.9, devenu nécessaire).
- **Tests** : cf. §21, Test 6.
- **Dépendances** : V1 doit être en prod et stable (le schéma `reservation_items` doit avoir prouvé sa fiabilité sur du trafic réel avant d'autoriser plusieurs lignes par réservation).
- **Risques** : impact sur le calcul de dispo si une pro combine des prestations aux buffers très différents (déjà couvert par l'algorithme existant, mais jamais testé en usage réel multi-item avant V3 — risque de test insuffisant en conditions réelles, pas de risque de conception).
- **Critères de sortie** : Test 6 + Test 7 (déplacement multi-item) au vert, aucune régression sur le cas 1-prestation (Test 1 rejoué), tri par `ordering_rank` vérifié sur un panier mixte.

---

## 21. Tests

### 21.1 Stratégie

- **Unit tests pricing engine** : fonction pure isolée (extraction recommandée d'une fonction `computeItemPricing(prestation, variants, options)` — qui lève/rejette si le total serait négatif, §5.3 — et `computeReservationTotals(items[])`, testables sans DB — pattern déjà suivi par `lib/bookingUtils.ts` côté mobile, à répliquer côté backend si ce n'est pas déjà le cas dans `reservation.service.ts`).
- **Tests API** : Zod (validation combinaison invalide, groupe requis, valeur inactive, config à prix/durée négatif rejetée) + intégration (création réservation avec variantes/options, code 422 attendu sur cas limites §18).
- **Tests snapshot** : modifier la prestation après réservation, vérifier que l'affichage historique ne change pas (nom, prix, durée, variantes, options), y compris après suppression logique d'une valeur/option référencée.
- **Tests disponibilité** : créneau bloqué correct pour un item avec variantes/options modifiant la durée ; pour plusieurs items triés par `ordering_rank` (V3).
- **Tests rétrocompatibilité** : une prestation sans variante/option/question suit exactement le chemin actuel (Test 1).
- **Tests duplication** : toute la config copiée, aucune donnée de réservation copiée, buffers/`pricing_mode`/`ordering_rank` inclus (corrige le bug §1.7/§17).
- **Tests multi-prestations V3** : création, reschedule cas A/B, annulation, affichage récap, tri par `ordering_rank`.

### 21.2 Scénarios demandés

1. **Prestation simple = comportement actuel** — aucune variante/option, prix/durée identiques à aujourd'hui, `reservation_items` a 1 ligne sans lignes filles variantes/options.
2. **Prestation + variante** — sélection d'une valeur de groupe obligatoire, prix/durée = base + delta.
3. **Prestation + variante + option** — cumul des deltas, vérifie l'ordre d'application (addition, pas de dépendance d'ordre par construction de la formule §5.1).
4. **Modification du prix après réservation** — pro change `prestations.price`, réservation existante conserve `snapshot_price` inchangé.
5. **Modification de durée après réservation** — idem sur `duration_minutes`/deltas, `snapshot_duration_minutes` et `blocked_end_datetime` de la réservation existante inchangés.
6. **Plusieurs prestations dans un rendez-vous** — 2-3 items avec `ordering_rank` différents, `total_price`/`total_duration` = somme correcte, `resolveServiceBlocking` applique buffers premier/dernier item correctement dans l'ordre trié.
7. **Déplacement d'un rendez-vous existant** — Cas A (§12.1) : nouvelle date, snapshots et prix/durée inchangés. Variante à ajouter : Cas B (§12.2) avec reconfiguration, prix recalculé.
8. **Configuration à prix négatif refusée** — pro tente de sauvegarder une combinaison dont la pire combinaison légale est négative → sauvegarde bloquée côté config ; si contournée, réservation rejetée en 422.

---

## 22. Risques

- **Risque de conformité RGPD (V2)** — désormais mitigé par le mécanisme verrouillé (§9.2 : flag + détection assistée + consentement dédié + rétention spécifique), mais reste le risque le plus sensible du chantier : dépend de la rigueur d'implémentation (le flag doit être branché sur *tous* les points d'entrée, pas seulement la création de question) et de la validation juridique du contenu (liste de mots-clés, texte de consentement).
- **Risque de régression sur le flux existant (V1)** — toute nouvelle étape de validation serveur (§5.3) doit être scrupuleusement rétrocompatible avec les prestations sans configuration (Test 1). Le principal danger est une régression silencieuse sur le parcours de réservation actuel, qui est en production et fonctionnel.
- **Risque d'incohérence de types mobile (transverse)** — tant que la migration des types (§15) reste progressive plutôt que big-bang, il existe une fenêtre où certains écrans lisent l'ancien type plat pendant que d'autres lisent le nouveau type enrichi ; nécessite une checklist explicite par écran migré pour éviter qu'un écran oublié affiche un prix non recalculé.
- **Risque de complexité d'écriture (tables normalisées, §3.2)** — chaque réservation avec variantes/options nécessite désormais plusieurs `INSERT` (au lieu d'un seul champ JSON) dans la même transaction ; à surveiller sur la performance d'écriture si un panier V3 comporte de nombreux items/options simultanément (volume faible attendu, risque theorique plus que réel).
- **Risque produit résiduel sur le "à partir de" (§6.1)** — le calcul est désormais verrouillé, mais reste dépendant de la qualité de configuration des pros (un groupe obligatoire mal paramétré peut afficher un "à partir de" élevé et surprenant) — pas un risque technique, un point à surveiller en usage réel après lancement.
- **Risque de sous-estimation du chantier "historique détaillé"** — §1.9/§10 : l'absence actuelle d'écran d'historique de RDV côté `client-detail.tsx` devient un manque plus visible dès que le multi-prestations existe ; intégré à la roadmap V3 (§20) mais reste un morceau de travail mobile substantiel, à ne pas sous-dimensionner dans l'estimation V3.

---

## 23. Point restant nécessitant une validation (hors architecture)

Un seul point n'est pas entièrement tranché par ce document, de nature volontairement non-architecturale :

- **§9.2** — le contenu exact de la liste de mots-clés de détection assistée et le texte du consentement dédié aux questions sensibles doivent être rédigés/validés avec un regard juridique avant la mise en production de V2. Le mécanisme technique (flag, détection, UI de consentement, rétention) peut être développé dès maintenant avec un contenu provisoire, sans attendre cette validation — seul le contenu final est bloquant pour le lancement de V2, pas son développement.

Toutes les autres décisions produit identifiées dans la version précédente de ce rapport sont verrouillées (§0) et n'ont plus besoin d'être revalidées pendant l'implémentation.

---

## Note de clôture

Aucun fichier de code n'a été modifié pendant la production de ce rapport. Sur la base des décisions verrouillées en §0, le développement peut démarrer comme un chantier unique visant directement l'architecture cible V3 (schéma complet posé dès la première migration), avec une exposition produit progressive V1 → V2 → V3 conformément à la roadmap §20. Le seul point encore en attente (§23, contenu RGPD) ne bloque que l'exposition finale de V2 aux clientes, pas son développement.
