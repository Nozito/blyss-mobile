# Design 4 — Dépréciation des slots précréés

> Statut : **validé CTO — 4.1 → 4.6a livrés et mergés**. 4.6b (suppression
> physique `slots` / `slot_id`) est prêt mais **différé** tant que 100 % des pros
> actives ne sont pas migrées. Fait suite aux chantiers 1 & 3 (moteur de
> disponibilités mergé). Objectif : sortir du modèle `slots` précréés manuellement
> au profit de `working_hours` + `getAvailability`, **sans rupture**.

## État au 2026-09-01

| Sous-chantier | PR | Statut |
|---|---|---|
| 4.1 — flag `uses_availability_engine` + adaptateur `slots → AvailabilityResponse` | blyss-app #7 | ✅ mergé |
| 4.2 — `migrate-pros-to-availability-engine.ts` | blyss-app #8 | ✅ mergé |
| 4.3 — éditeur `working_hours` mobile (`app/pro-working-hours.tsx`) | blyss-mobile #3 | ✅ mergé |
| 4.4 — `calendar.tsx` mode moteur (lecture seule) | blyss-mobile #3 | ✅ mergé |
| 4.5 — bannière d'onboarding pros existantes | blyss-mobile #3 | ✅ mergé |
| 4.6a — audit + contrainte `EXCLUDE` (non appliquée) + dépréciation douce des routes | blyss-app #9 | ✅ mergé |
| 4.6b prep — `cleanup-legacy-slots.ts` + migration `drop_slot_id` auto-gardée + flag `SLOTS_HARD_DEPRECATION` + seed sans chevauchement | blyss-app #9 | ✅ mergé |
| 4.6b exécution — `DELETE FROM slots` / `DROP COLUMN slot_id` / `DROP TABLE slots` / suppression des routes | — | ⏸️ bloqué : **0/16 pros actives migrées** |

Détail d'implémentation et procédure post-migration : voir [§6](#6-implémentation-46--procédure-de-sortie).

---

## 1. Audit de `app/(pro)/calendar.tsx` (2123 lignes)

### 1.1 Ce qui dépend des `slots`

| Zone | Lignes | Rôle | Devient |
|---|---|---|---|
| `type TimeSlot` | 49-56 | modèle local d'un slot précréé | supprimé |
| `checkOverlap()` | 100-112 | anti-chevauchement **client-side** avant `createSlot` | supprimé (le backend gère) |
| `mapSlot()` | 117-124 | mapping réponse `/api/pro/slots` | supprimé |
| `state slots / slotsLoading / slotError` | 457-494 | liste des slots du jour | remplacé par état dérivé de `getAvailability` (lecture seule) |
| `state planningSlots / planningDuration` | 488-501 | brouillon du "planning hebdo" | remplacé par l'éditeur `working_hours` (§3) |
| `fetchSlots()` → `proApi.getSlots({date})` | 542-552 | charge les slots du jour | supprimé |
| `useEffect fetchSlots` | 555 | recharge à chaque changement de date | remplacé par un fetch `getAvailability` sur la semaine visible |
| `toggleSlot()` → `proApi.updateSlot(status)` | 725-735 | bloquer/débloquer un slot ponctuel | remplacé par une **indisponibilité ponctuelle** (`unavailabilities` avec `start_time`/`end_time`, déjà migré en 3.2) |
| `addSlot()` → `proApi.createSlot` + `checkOverlap` | 737-759 | créer un slot ponctuel | supprimé — un créneau libre découle des `working_hours` |
| `confirmEditSlot()` → `proApi.updateSlot` | 761-780 | déplacer/redimensionner un slot | supprimé |
| `deleteSlot()` → `proApi.deleteSlot` | 782-793 | supprimer un slot | remplacé par indisponibilité ponctuelle si le besoin est "je ne travaille pas à cette heure-là" |
| `applyWeeklyPlanning()` / `doApplyWeeklyPlanning()` | 908-980 | génère N×`createSlot` en masse sur plusieurs semaines | **remplacé par l'éditeur `working_hours`** — une plage récurrente, pas des lignes matérialisées |
| Bloc rendu "SLOTS" | 1280-1470 | liste éditable des créneaux du jour | remplacé par une vue lecture seule : créneaux libres (issus de `getAvailability`) + RDV + indispos |
| Sheet "Nouveau créneau" | ~1480-1590 | UI `addSlot` | supprimée |
| Modale "planning hebdo" | ~1850-2070 | UI `applyWeeklyPlanning` | remplacée par l'écran `working_hours` |
| Modale "supprimer créneau" | ~2075 | confirm `deleteSlot` | supprimée |

### 1.2 Ce qui NE dépend PAS des slots (inchangé)

- `fetchMonthData()` / `proApi.getCalendar()` / `proApi.getUnavailabilities()` — les RDV et les absences (jour entier) restent la source de vérité de la vue mois/semaine.
- `NewAppointmentSheet` — déjà migré sur `getAvailability` (chantier 3).
- Gestion des RDV (`handleComplete` / `handleCancel` / `handleNoShow` / reschedule).
- Recherche, deep-link Live Activity, sync calendrier natif.
- Modale "indisponibilité" (période jour entier) — conservée, **complétée** d'un mode "créneau ponctuel" (heure).

### 1.3 Endpoints backend concernés

| Endpoint | Sort |
|---|---|
| `POST /api/pro/slots`, `GET /api/pro/slots`, `PATCH/DELETE /api/pro/slots/:id` | **dépréciés** — 410 Gone après bascule complète, puis suppression |
| `POST/GET/PATCH/DELETE /api/slots/*` (routes publiques legacy) | idem |
| `GET /api/slots/available/:proId/:date`, `/available-dates/:proId/:month` | remplacés par `GET /api/availability/:proId` (déjà livré) |
| `slots` (table) | conservée en lecture le temps de la dépréciation, `DROP TABLE` en toute fin (PR dédiée, après audit qu'aucune réservation active ne la référence via `slot_id`) |

> `reservations.slot_id` : colonne conservée (NULL pour tout RDV créé par le nouveau
> moteur). Nettoyage `slot_id`/`slots` = dernière PR du chantier, séparée.

---

## 2. Bascule — feature flag `USE_NEW_AVAILABILITY_ENGINE`

### 2.1 Où vit le flag

**Côté backend, par pro**, pas un flag mobile local — pour piloter la bascule
progressive et éviter qu'une pro voie deux modèles selon l'appareil.

```sql
-- migration
ALTER TABLE users ADD COLUMN uses_availability_engine BOOLEAN NOT NULL DEFAULT FALSE;
```

- Exposé dans `GET /api/users` (profil pro) : `uses_availability_engine`.
- Bascule : `PUT /api/users/update` (admin ou la pro elle-même via l'onboarding
  du nouvel éditeur `working_hours` — cf. §3.4), jamais silencieuse.
- Kill-switch global : `process.env.AVAILABILITY_ENGINE_FORCE_OFF=true` fait
  répondre `getAvailability`/`checkSlotAvailability` comme "non migré" quel que
  soit le flag pro (rollback d'urgence sans migration).

### 2.2 Comportement selon le flag

| | `uses_availability_engine = false` (défaut) | `= true` |
|---|---|---|
| `GET /api/availability/:proId` (public) | lit encore les `slots` précréés (adaptateur : `SELECT ... FROM slots WHERE status='available'` mappé au format `AvailabilityResponse`) | calcul complet `working_hours` − indispos − réservations |
| `POST /api/reservations` | inchangé (verrou + snapshot ; `checkSlotAvailability` tolère l'absence de `working_hours` — déjà le cas, cf. garde-fou 3.3) | idem, mais `checkSlotAvailability` enforce les horaires |
| `POST /api/pro/appointments` | overrides indisponibles (pas d'horaires de référence → tout est "hors horaires") → on **désactive le mode override** et on retombe sur l'ancien check de chevauchement | overrides A/B actifs |
| Mobile `calendar.tsx` | onglet "Créneaux" legacy (slots CRUD) | onglet "Disponibilités" (lecture seule) + accès à l'éditeur `working_hours` |
| Mobile `NewAppointmentSheet` | `getAvailability` renvoie les slots précréés → le sélecteur fonctionne déjà | idem, créneaux calculés |

**Point clé** : `NewAppointmentSheet` (chantier 3) marche **dans les deux modes**
sans branche — `getAvailability` sert d'adaptateur. Seul `calendar.tsx` a besoin
d'un `if (uses_availability_engine)` en haut du composant.

### 2.3 Plan de bascule

1. **Phase 0** (cette PR) : flag + adaptateur `slots → AvailabilityResponse` pour le mode `false`. Aucune pro basculée. Non-régression totale.
2. **Phase 1** : nouvelles pros (`created_at > date_migration`) créées avec `uses_availability_engine = true` + onboarding `working_hours` obligatoire.
3. **Phase 2** : bannière in-app pour les pros existantes → "Configure tes horaires d'ouverture" → à la validation de l'éditeur `working_hours`, `uses_availability_engine` passe à `true` et leurs `slots` précréés futurs sont supprimés (script, après snapshot).
4. **Phase 3** : quand < X % de pros encore en `false`, migration forcée + accompagnement support.
5. **Phase 4** (PR séparée) : suppression du flag, des routes `slots`, de la table `slots`, de `reservations.slot_id`. Ajout de la contrainte `EXCLUDE USING gist` (dette technique identifiée au chantier 3.2).

### 2.4 Tests

- Unit : `getAvailability` mode `false` (adaptateur slots) vs `true` — même contrat de réponse.
- Unit : `AVAILABILITY_ENGINE_FORCE_OFF` court-circuite le flag pro.
- E2E (extension de `loadtest-e2e-availability.ts`) : une pro `false` + une pro `true` en parallèle, le flow client marche pour les deux.
- Non-régression : la suite existante `slots` reste verte tant que les routes existent.

---

## 3. Écran de gestion des `working_hours` (app pro)

### 3.1 Backend — endpoints à créer

```
GET    /api/pro/working-hours
  → { days: [ { weekday: 0..6, ranges: [ { id, start_time, end_time } ] } ] }

PUT    /api/pro/working-hours
  body: { days: [ { weekday, ranges: [ { start_time, end_time } ] } ] }
  → remplace TOUTES les plages de la pro (upsert transactionnel : DELETE puis INSERT
    sous pg_advisory_xact_lock(pro_id) pour ne pas croiser une lecture de dispo).
  → 422 si une plage a end_time <= start_time ou si deux plages d'un même jour
    se chevauchent (validé serveur, pas seulement mobile).
  → À la première sauvegarde non vide : passe uses_availability_engine = true
    (cf. §2.3 phase 2) + renvoie { migrated: true } pour que le mobile affiche
    l'explication.
```

- Auth : `authMiddleware` + `requireProAccess`, `pro_id = getProId(req)`.
- RLS : `working_hours` déjà `ENABLE RLS` + `REVOKE` (migration 3.2).
- Pas de PII.

### 3.2 Mobile — `lib/api.ts`

```ts
proApi.getWorkingHours(): Promise<ApiResponse<{
  days: { weekday: number; ranges: { id: number; start_time: string; end_time: string }[] }[];
}>>

proApi.setWorkingHours(days: {
  weekday: number; ranges: { start_time: string; end_time: string }[];
}[]): Promise<ApiResponse<{ migrated: boolean }>>
```

### 3.3 Écran — `app/(pro)/working-hours.tsx` (nouveau)

Maquette (vue semaine, 7 lignes) :

```
┌─────────────────────────────────────────────┐
│  Horaires d'ouverture                    ✕  │
│  Les créneaux réservables en découlent.      │
├─────────────────────────────────────────────┤
│  Lundi        ●          09:00 – 12:30   ✕  │
│                          13:30 – 18:00   ✕  │
│                          + ajouter une plage │
│  Mardi        ●          09:00 – 18:00   ✕  │
│  Mercredi     ○  Fermé                       │
│  Jeudi        ●          09:00 – 18:00   ✕  │
│  Vendredi     ●          09:00 – 17:00   ✕  │
│  Samedi       ●          10:00 – 16:00   ✕  │
│  Dimanche     ○  Fermé                       │
├─────────────────────────────────────────────┤
│  [ Copier lundi → tous les jours ]           │
│  [ Enregistrer ]                             │
└─────────────────────────────────────────────┘
```

- Toggle par jour (ouvert/fermé) ; plages multiples via `+ ajouter une plage`.
- Sélecteurs d'heure par pas de 15 min (réutilise le pattern `NewAppointmentSheet`).
- Validation locale : `start < end`, pas de chevauchement intra-jour (miroir du 422 serveur).
- Raccourci "copier lundi → tous".
- **Première sauvegarde** : si `migrated: true`, écran de confirmation :
  « Tes horaires sont enregistrés. Tes créneaux réservables sont maintenant
  calculés automatiquement — plus besoin de créer des créneaux un par un. Tes
  anciens créneaux ouverts non réservés ont été retirés. »
- Accès : depuis `calendar.tsx` (bouton "Horaires" remplaçant "Planning" quand
  `uses_availability_engine`, ou bannière d'onboarding sinon) + depuis les
  réglages pro.

### 3.4 `calendar.tsx` en mode `uses_availability_engine = true`

- L'onglet/section "Créneaux" devient **"Disponibilités"** — lecture seule :
  - créneaux libres du jour (issus de `getAvailability` sur la semaine, filtrés au jour sélectionné),
  - RDV (déjà là),
  - indisponibilités ponctuelles/jour (déjà là, + nouveau mode heure).
- Bouton `+ Créneau` → devient `+ Indisponibilité` (bloquer une plage ponctuelle) ; `+ RDV` inchangé (`NewAppointmentSheet`).
- Bouton `Planning` → `Horaires` (ouvre `working-hours.tsx`).
- `toggleSlot` "bloquer ce créneau" → crée une `unavailability` ponctuelle sur `[slot.start, slot.end]`.

### 3.5 Tests

- Unit `lib/api.ts` : `getWorkingHours` / `setWorkingHours` (mapping, `migrated`).
- Component (si la suite `jest.rn` est réparée — sinon reporté) : `working-hours.tsx` (toggle jour, ajout/suppression de plage, validation chevauchement).
- E2E : `PUT /api/pro/working-hours` → `GET /api/availability/:proId` reflète les nouvelles plages ; 2ᵉ sauvegarde ne re-migre pas.
- Backend : validation 422 (chevauchement, end<=start), `uses_availability_engine` passe à `true` une seule fois.

---

## 4. Ordre de livraison proposé

| PR | Contenu | Livré |
|---|---|---|
| 4.1 | migration `uses_availability_engine` + kill-switch + adaptateur `slots → AvailabilityResponse` dans `getAvailability` (mode `false`) + tests | ✅ blyss-app #7 |
| 4.2 | endpoints `GET/PUT /api/pro/working-hours` + validation + `migrate-pros-to-availability-engine.ts` + tests/E2E | ✅ blyss-app #8 |
| 4.3 | mobile : `app/pro-working-hours.tsx` + `lib/api.ts` + entrée depuis `calendar.tsx` | ✅ blyss-mobile #3 |
| 4.4 | mobile : `calendar.tsx` mode `uses_availability_engine` (vue lecture seule) derrière le flag | ✅ blyss-mobile #3 |
| 4.5 | bannière d'onboarding pros existantes | ✅ blyss-mobile #3 |
| 4.6a | audit `audit-slots-and-overlaps.ts` + migration `EXCLUDE USING gist` (non appliquée) + dépréciation douce (`guardLegacySlotWrite` → 410) | ✅ blyss-app #9 |
| 4.6b prep | `cleanup-legacy-slots.ts` + migration `drop_slot_id` auto-gardée + flag `SLOTS_HARD_DEPRECATION` + seed sophie sans chevauchement | ✅ blyss-app #9 |
| 4.6b exécution | migration forcée des pros restantes + `DELETE FROM slots` + `DROP COLUMN slot_id` + `DROP TABLE slots` + suppression des routes legacy + purge des réfs `slot_id` dans le code | ⏸️ à faire quand `active_migrated == active_total` |

---

## 5. Décisions CTO (questions initialement ouvertes)

1. **Granularité du flag** → **par pro** (`users.uses_availability_engine`). Un seul
   `if (useNewEngine)` en haut de `calendar.tsx`, `NewAppointmentSheet` inchangé
   grâce à l'adaptateur.
2. **`slots` ouverts non réservés à la bascule** → **suppression sèche après
   snapshot** (fichier JSON dans `backend/migration-snapshots/`), via
   `--force-clear-open` (script 4.2) puis `cleanup-legacy-slots.ts` (4.6b).
3. **Point d'entrée de la bascule** → **l'éditeur `working_hours`** : première
   sauvegarde non vide ⇒ `uses_availability_engine = true` + `{ migrated: true }`
   ⇒ toast d'explication mobile.
4. **Indisponibilité récurrente** → **hors périmètre** : le modèle `working_hours`
   la gère nativement (ne pas créer la plage). Pas de 4ᵉ plage "pause".

---

## 6. Implémentation 4.6 & procédure de sortie

### 6.1 Scripts (repo `blyss-app`)

| Script | Rôle | Sécurité |
|---|---|---|
| `backend/audit-slots-and-overlaps.ts` | lecture seule : avancement bascule, slots orphelins, résas sans `blocked_*`, paires en chevauchement bloquant `EXCLUDE` | aucun write |
| `backend/migrate-pros-to-availability-engine.ts` | bascule les pros éligibles (working_hours + pas de slot ouvert à venir) ; `--dry-run`, `--pro`, `--limit`, `--force-clear-open` | snapshot avant tout write |
| `backend/cleanup-legacy-slots.ts` | supprime les slots des pros **déjà migrées** ; `--execute` requis (dry-run par défaut), `--pro`, `--batch`, `--force-booked` | snapshot par pro, DELETE transactionnel, ignore les pros dont un slot est encore lié à une résa non annulée |

### 6.2 Migrations (`supabase/migrations/`)

| Fichier | Effet | État |
|---|---|---|
| `20260902000001_availability_engine.sql` | `working_hours`, colonnes `blocked_*` + backfill futur | appliquée |
| `20260903000001_availability_engine_flag.sql` | `users.uses_availability_engine` | appliquée |
| `20260904000001_reservations_no_overlap.sql` | contrainte `EXCLUDE USING gist (pro_id =, tstzrange(blocked_start, blocked_end) &&)` sur `confirmed`/`pending`, hors override `conflict` | **non appliquée** — prérequis : 0 paire chevauchante (re-seed sophie fait) |
| `20260904000002_drop_reservations_slot_id.sql` | `DROP COLUMN reservations.slot_id` + `DROP INDEX idx_reservations_slot` | **auto-gardée** : `RAISE EXCEPTION` (rollback) tant qu'il reste une pro active legacy ou une résa non annulée avec `slot_id` |

### 6.3 Flag `SLOTS_HARD_DEPRECATION`

Env var backend, défaut `off`. À `true` : `guardLegacySlotWrite` renvoie `410
SLOTS_DEPRECATED` **pour toutes les pros** (plus seulement les migrées) sur
`POST /api/pro/slots`, `POST /api/slots/create`, `PATCH /api/pro/slots/:id`.
Étape intermédiaire avant la suppression physique des routes.

### 6.4 Procédure post-merge

**Phase 1 — bascule progressive**
```bash
ts-node backend/migrate-pros-to-availability-engine.ts --dry-run
ts-node backend/migrate-pros-to-availability-engine.ts --limit 10
ts-node backend/audit-slots-and-overlaps.ts   # vérifie l'avancement
```

**Phase 2 — quand `active_migrated == active_total`**
```bash
node scripts/db.mjs seed                       # re-seed sophie (E2E)
node scripts/db.mjs push                       # applique 20260904000001 + 000002
ts-node backend/cleanup-legacy-slots.ts --execute
# .env.prod : SLOTS_HARD_DEPRECATION=true  → redémarrage backend
```

**Phase 3 — PR de nettoyage final**
- suppression des routes `POST /api/pro/slots`, `GET /api/slots/available/:proId/:date`, `PATCH/DELETE /api/pro/slots/:id`, routes `/api/slots/*` legacy
- `DROP TABLE slots`
- purge des ~53 références `slot_id` dans le code booking / reschedule / cancellation
- retrait du flag `SLOTS_HARD_DEPRECATION` (devenu inconditionnel)
- mise à jour de cette doc → chantier clos
