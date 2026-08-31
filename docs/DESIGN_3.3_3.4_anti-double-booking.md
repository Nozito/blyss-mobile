# Design 3.3 + 3.4 — Anti-double-booking transactionnel & ajout manuel pro

> Statut : **proposition — en attente de validation CTO**. Aucun code n'est écrit avant validation.
> Repo backend : `blyss-app`. Repo mobile : `blyss-mobile` (ce dépôt).
> Pré-requis : audit 3.1 + design moteur 3.2 (services `availability.service.ts` /
> `reservation.service.ts` à créer).

---

## 0. Périmètre et articulation avec 3.2

3.3 et 3.4 partagent le même socle : **un seul chemin d'écriture de réservation**,
`reservation.service.ts`, qui centralise la logique aujourd'hui dupliquée dans
`server.ts` (handler `POST /api/reservations` ~L6612 et `POST /api/pro/appointments`)
et alignée sur le pattern déjà éprouvé de `reschedule.service.ts`
(lock → re-check sous verrou → mutation → commit → notification post-commit).

- **3.3** = garantir qu'aucune réservation bloquante ne se chevauche, même sous
  concurrence, pour le flow **client public**.
- **3.4** = permettre à la pro de créer un RDV via le **même moteur**, avec deux
  modes d'override explicitement audités.

Les deux consomment `checkSlotAvailability()` (lecture) de 3.2. 3.4 ajoute une
couche d'autorisation d'override par-dessus le même résultat.

---

## 1. Mécanisme de verrouillage (3.3)

### 1.1 Principe

Réutiliser `pg_advisory_xact_lock(key)` — verrou consultatif lié à la transaction,
libéré automatiquement au COMMIT/ROLLBACK, déjà utilisé et testé dans
`reschedule.service.ts`.

- **Clé de verrou** : dérivée du seul `pro_id`. Un `pg_advisory_xact_lock` prend un
  `bigint` (ou deux `int4`). On utilise la forme à deux `int4` :
  `pg_advisory_xact_lock(:namespace, pro_id)` avec `namespace = 0x424C` (constante
  `RESERVATION_LOCK_NS`, exportée depuis `reservation.service.ts`) pour éviter toute
  collision avec un futur verrou sur une autre ressource au même `pro_id`.
- **Granularité** : par pro. Deux réservations chez deux pros différentes ne se
  bloquent jamais. Deux réservations chez la même pro sont sérialisées le temps du
  re-check + INSERT (quelques ms).
- **Portée** : le verrou est pris **après** `BEGIN`, **avant** le re-check, et
  couvre re-check + INSERT + INSERT notifications. Aucune I/O réseau (paiement,
  push) ne se fait sous verrou.

### 1.2 Centralisation

Nouveau fichier `backend/services/reservation.service.ts` :

```ts
export const RESERVATION_LOCK_NS = 0x424c; // "BL"

interface CreateReservationInput {
  proId: number;
  clientId: number;
  serviceIds: number[];
  startDatetime: string;          // ISO instant
  requestedByRole: "public" | "pro";
  // 3.4 uniquement :
  manualOverride?: {
    mode: "outside_hours" | "conflict";
    reason: string;               // obligatoire pour "conflict", optionnel sinon
    overrideByUserId: number;
    acknowledgedConflictReservationIds?: number[];
  };
  // métadonnées existantes conservées : initiated_via, early_execution_requested, etc.
}

interface CreateReservationResult {
  reservation: ReservationRow;
  overrideApplied: null | "outside_hours" | "conflict";
}
```

`server.ts` : les deux handlers deviennent de fines couches HTTP (auth → validation
de forme → appel service → mapping code HTTP). Toute la logique métier descend dans
le service. `reschedule.service.ts` : `acceptRescheduleRequest()` est refactoré pour
appeler la brique de verrou/re-check partagée (extraction d'un helper
`withProReservationLock(client, proId, fn)`), sans changer son comportement observable
— la suite `reschedule-consent.test.ts` (16 cas) doit rester verte sans modification.

---

## 2. Séquence exacte de création (3.3)

Ordre strict, identique pour client et pro (l'override 3.4 n'insère qu'une branche
de décision au point 4) :

| # | Étape | Sous verrou ? | Notes |
|---|-------|---------------|-------|
| 1 | Validation de forme + autorisation applicative (`pro_id`, `client_id`) | non | 422 si invalide, 403 si accès refusé |
| 2 | `checkSlotAvailability()` — pré-check optimiste (lecture seule, hors tx) | non | Court-circuit rapide : 409 immédiat si déjà indisponible. Évite d'ouvrir une tx pour rien |
| 3 | `BEGIN` | — | `isolation = READ COMMITTED` (défaut) suffit car le verrou sérialise |
| 4 | `pg_advisory_xact_lock(RESERVATION_LOCK_NS, pro_id)` | **oui (prise)** | Bloque jusqu'à obtention |
| 5 | **Re-check** `checkSlotAvailability()` sous verrou (même connexion tx) | **oui** | Lit `reservations` avec `FOR SHARE`? Non : lecture simple suffit, le verrou advisory garantit l'exclusion mutuelle des écrivains |
| 6 | Si conflit → `ROLLBACK` → **409** `SLOT_NO_LONGER_AVAILABLE` (+ `alternativeSlots`) | oui | 3.4 : si `manualOverride` autorisé, on ne rollback pas → étape 7 |
| 7 | Calcul du **snapshot** (`service_duration_minutes`, `buffer_before/after_minutes`, `blocked_start/end_datetime`, `timezone`) | oui | Figé une fois pour toutes, jamais recalculé |
| 8 | `INSERT INTO reservations` (status `pending` ou `confirmed` selon flow paiement existant) | oui | |
| 9 | `INSERT INTO notifications` / événements d'audit (dont ligne d'override 3.4) | oui | |
| 10 | `COMMIT` (libère le verrou) | — | |
| 11 | Effets **post-commit** : push notif, e-mail, création PaymentIntent Stripe si applicable | non | En cas d'échec ici, la réservation existe déjà → retry/asynchrone, pas de rollback |
| 12 | Réponse **201** avec la réservation, ou **409/422** selon le cas | — | |

### 2.1 Interaction avec le paiement en attente

Le flow actuel crée la réservation en `pending` puis un PaymentIntent. Une
réservation `pending` **bloque** le créneau (`status NOT IN ('cancelled')` — cf.
règle 4 de 3.2). Expiration d'un `pending` non payé : un job (déjà existant ou à
préciser avec 3.2) passe le statut à `cancelled` → le créneau se relibère
naturellement au prochain `getAvailability`. Aucune logique spéciale ici : le
re-check lit l'état courant.

---

## 3. Codes HTTP et messages d'erreur

| Cas | Code | Body |
|-----|------|------|
| Créneau pris entre pré-check et commit (concurrence) | **409** | `{ "error": "SLOT_NO_LONGER_AVAILABLE", "message": "Ce créneau vient d'être réservé.", "alternativeSlots": [{ "start": "…", "end": "…" }] }` |
| Départ hors horaires d'ouverture (flow public) | **409** | `{ "error": "OUTSIDE_WORKING_HOURS", "message": "…", "alternativeSlots": [...] }` |
| Départ avant `now + lead_time` ou après horizon | **422** | `{ "error": "OUTSIDE_BOOKING_WINDOW", "message": "…" }` |
| `service_ids` inconnu / prestation non `is_online_bookable` (flow public) | **422** | `{ "error": "SERVICE_NOT_BOOKABLE" }` |
| Payload malformé (date non ISO, tableau vide…) | **422** | `{ "error": "INVALID_INPUT", "details": [...] }` |
| Client tente de réserver pour un autre `client_id` / pro pour un autre `pro_id` | **403** | `{ "error": "FORBIDDEN" }` |
| Non authentifié | **401** | `{ "error": "UNAUTHORIZED" }` |
| Override demandé par un rôle non-pro | **403** | `{ "error": "OVERRIDE_NOT_ALLOWED" }` |
| Override `conflict` sans `reason` | **422** | `{ "error": "OVERRIDE_REASON_REQUIRED" }` |

`alternativeSlots` : jusqu'à 3 créneaux, issus d'un `getAvailability()` sur
`[jour demandé, jour demandé + 7]`, filtrés aux plus proches de l'horaire demandé.
Calculé **hors transaction**, après le rollback, best-effort (si l'appel échoue,
`alternativeSlots: []`).

---

## 4. Tests de concurrence prévus (3.3)

Style : intégration Postgres réelle (comme `reschedule-consent.test.ts`), deux
`Promise` lancées sans `await` intermédiaire, `Promise.allSettled`.

| # | Scénario | Attendu |
|---|----------|---------|
| C1 | 2 clientes confirment exactement le même créneau en parallèle | 1× 201, 1× 409 `SLOT_NO_LONGER_AVAILABLE`. Une seule ligne en base |
| C2 | Créneau chevauchant (pas identique) : A 10:00–11:00, B 10:30–11:30 | 1× 201, 1× 409 |
| C3 | `pending` expiré + nouvelle réservation sur le même créneau | Après passage `cancelled`, la 2ᵉ réservation réussit (201) |
| C4 | Annulation de A + réservation de B sur le créneau de A, en parallèle | Les deux réussissent (A→cancelled, B→201) ; si l'annulation perd la course, B → 409 puis réussit au retry |
| C5 | `acceptRescheduleRequest` déplace vers un créneau qu'une cliente réserve au même instant | 1 seul gagnant ; le perdant reçoit 409 (reschedule) ou `SLOT_NO_LONGER_AVAILABLE` (client) |
| C6 | 2 pros, créneaux « identiques » (heure), pros différentes | 2× 201, aucun blocage mutuel (vérifie la clé de verrou par pro) |
| C7 | Override `conflict` pro + réservation cliente sur la période, en parallèle | L'override réussit ; la cliente → 409 (la période devient bloquante) |
| C8 | DST : réservation le dernier dimanche d'octobre à 02:30 Europe/Paris | Snapshot `blocked_*` en TIMESTAMPTZ correct, pas de double créneau |

Plus tests unitaires du service (mock DB) pour le mapping erreurs → codes HTTP, et
un test « le verrou est bien relâché après ROLLBACK » (une 3ᵉ requête séquentielle
après C1 réussit).

---

## 5. Design des overrides (3.4)

### 5.1 Champs d'audit (migration sur `reservations`)

```sql
ALTER TABLE reservations ADD COLUMN manual_override_reason TEXT
  CHECK (manual_override_reason IN ('outside_hours', 'conflict'));   -- NULL = pas d'override
ALTER TABLE reservations ADD COLUMN manual_override_by_user_id INT REFERENCES users(id);
ALTER TABLE reservations ADD COLUMN manual_override_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN manual_override_note TEXT;        -- motif libre (obligatoire si 'conflict')
ALTER TABLE reservations ADD COLUMN manual_override_conflicts JSONB;  -- [{reservation_id, client_masqué, start, end}] au moment de l'override
```

- `manual_override_conflicts` ne stocke **pas** de PII (pas de nom/téléphone) : juste
  les `reservation_id` impactés + bornes horaires. Suffisant pour l'audit, conforme
  minimisation RGPD.
- Rétention : ces colonnes suivent la rétention de la réservation elle-même. Purge
  avec la réservation.

### 5.2 Override A — Hors horaires d'ouverture

- **Déclencheur** : `checkSlotAvailability` renvoie `reason: "outside_hours"` et
  **aucun** autre motif bloquant (pas de chevauchement réservation).
- **Autorisation** : pro authentifiée = propriétaire du `pro_id`. Avertissement
  simple côté mobile (« Ce créneau est en dehors de tes horaires d'ouverture »).
- **Effet base** : `manual_override_reason = 'outside_hours'`, `..._by_user_id`,
  `..._at`. `manual_override_note` facultatif.
- **Impact disponibilité publique** : **aucun élargissement**. Le RDV est bien
  inséré et son snapshot `blocked_*` rend *sa propre* plage indisponible, mais les
  heures voisines ne deviennent pas réservables publiquement (elles restent hors
  `working_hours`).

### 5.3 Override B — Conflit volontaire

- **Déclencheur** : `checkSlotAvailability` renvoie `reason: "overlaps_reservation"`.
- **Autorisation** : pro propriétaire. **Avertissement fort** + affichage du/des RDV
  impacté(s) (côté mobile : prénom cliente + horaire, données que la pro possède
  déjà légitimement) + **motif obligatoire** (`manual_override_note`, non vide).
- **Effet base** : `manual_override_reason = 'conflict'`,
  `manual_override_conflicts = [...]` (snapshot sans PII),
  `manual_override_by_user_id`, `manual_override_at`, `manual_override_note`.
- Le/les RDV impactés **ne sont pas modifiés** (pas d'annulation automatique) : la
  pro gère la communication. On journalise seulement.
- **Impact disponibilité publique** : la nouvelle réservation est bloquante
  (`status NOT IN ('cancelled')`), donc `getAvailability` retire sa plage du public.
  Double booking assumé et tracé, pas masqué.

### 5.4 Séquence 3.4 (delta vs §2)

Étape 4/5 (sous verrou), après re-check :
- Si `available` → insertion normale, `overrideApplied = null`.
- Si conflit **et** `manualOverride` fourni **et** rôle = pro **et** mode cohérent
  avec le `reason` renvoyé → on poursuit l'insertion, on remplit les colonnes
  d'audit, `overrideApplied = mode`.
- Si conflit **et** pas de `manualOverride` → 409 (comme flow public), body enrichi
  d'un flag `canOverride: true` pour que le mobile propose le mode dégradé.
- Si `manualOverride.mode` ne correspond pas au `reason` réel (ex. la pro demande
  `outside_hours` mais c'est en fait un chevauchement) → 409 avec le vrai motif,
  pas d'insertion (la pro doit confirmer le bon mode).

### 5.5 UX pro (mobile — `NewAppointmentSheet.tsx` + `calendar.tsx`)

- Remplacer la liste de créneaux statiques (`proApi.getSlots` / `createSlot`) par un
  sélecteur alimenté par `getAvailability(proId, [serviceIds], jour, jour, tz, role:"pro")`.
  Les créneaux calculés remplacent la saisie libre d'heure.
- La pro peut toujours saisir une heure hors liste → déclenche un appel
  `checkSlotAvailability` ; selon le `reason` :
  - `outside_hours` → bandeau orange + case « Ajouter quand même hors horaires ».
  - `overlaps_reservation` → bandeau rouge + carte du RDV impacté + champ motif
    obligatoire + case « Forcer malgré le conflit ».
- **Pas de mutation optimiste** du créneau affiché (règle déjà appliquée sur le
  chemin reschedule au commit 22dc456 — on étend la même discipline ici).
- **Toasts distincts** :
  - RDV normal ajouté → « RDV ajouté ».
  - Override A → « RDV ajouté hors horaires ».
  - Override B → « RDV ajouté malgré un conflit — pense à prévenir la cliente
    concernée ».
  - (Chemin reschedule inchangé : « Proposition envoyée, en attente de confirmation ».)
- `lib/api.ts` : `proApi.createAppointment` gagne `manual_override?: { mode, reason,
  acknowledged_conflict_ids }` ; type de retour discriminé
  (`{ overrideApplied: null | "outside_hours" | "conflict" }`). Gestion du 409
  `canOverride` pour réafficher la sheet en mode dégradé.

### 5.6 Endpoint

`POST /api/pro/appointments` — refactoré pour appeler `reservation.service.ts` avec
`requestedByRole: "pro"`. Auth : middleware pro existant + vérification
`pro_id == session.pro_id`. Le `client_id` fourni doit appartenir au carnet de la
pro (cliente ayant déjà une relation, ou création cliente « walk-in » selon le flow
existant — à confirmer, hors périmètre strict 3.4).

---

## 6. Tests spécifiques 3.4

| # | Scénario | Attendu |
|---|----------|---------|
| M1 | Ajout manuel sur créneau normalement disponible | 201, `manual_override_reason IS NULL` |
| M2 | Ajout manuel hors horaires, `mode:"outside_hours"` | 201, colonnes d'audit remplies, `getAvailability` public **inchangé** sur les heures voisines |
| M3 | Ajout manuel hors horaires **sans** `manualOverride` | 409 `OUTSIDE_WORKING_HOURS` + `canOverride: true` |
| M4 | Ajout manuel en conflit, `mode:"conflict"` + motif | 201, `manual_override_conflicts` peuplé (sans PII), le créneau devient **indisponible côté public** (test `getAvailability` avant/après) |
| M5 | Ajout manuel en conflit **sans motif** | 422 `OVERRIDE_REASON_REQUIRED` |
| M6 | `mode:"outside_hours"` mais vrai motif = conflit | 409 avec le vrai motif, aucune insertion |
| M7 | Une cliente tente de réserver le créneau que la pro vient de forcer (B) | 409 `SLOT_NO_LONGER_AVAILABLE` |
| M8 | Pro A tente `POST /api/pro/appointments` avec `pro_id` de pro B | 403 |
| M9 | Concurrence : override B pro + réservation cliente simultanée (= C7) | override gagne ou perd proprement, jamais 2 lignes non tracées |

---

## 7. Sécurité & RGPD

- **Contrôle d'accès par endpoint** :
  - `POST /api/reservations` (public/client) : session cliente obligatoire,
    `client_id` forcé = `session.client_id` (jamais lu du body), `pro_id` doit
    exposer au moins une prestation `is_online_bookable`.
  - `POST /api/pro/appointments` : session pro, `pro_id` = `session.pro_id`.
  - Override : refusé si `requestedByRole !== "pro"`, même si le champ est présent
    dans le body.
- **Pas de PII dans les logs** : les logs de conflit/erreur ne contiennent que
  `pro_id`, `reservation_id`, bornes horaires ISO. Jamais nom/téléphone/adresse
  cliente. `manual_override_note` (saisi par la pro) n'est **pas** loggé, seulement
  stocké.
- **RLS** : `working_hours` et les nouvelles colonnes → `ENABLE ROW LEVEL SECURITY` +
  `FORCE`, policies **deny-all** par défaut (le backend passe en `service_role` et
  bypass, mais deny-all protège contre un accès direct/anon futur). Documenté dans
  la migration.
- **Minimisation** : `manual_override_conflicts` volontairement sans identité
  cliente.
- **Rétention** : snapshots (`blocked_*`, `service_duration_*`) et colonnes
  d'override purgés avec la réservation (politique de rétention réservations
  existante — à référencer explicitement dans la migration, pas de nouvelle
  politique inventée ici).
- **Point à faire valider par la compétence cybersécurité avant merge** :
  (a) forme de la clé `pg_advisory_xact_lock` à deux `int4` + namespace ;
  (b) policies RLS deny-all sur `working_hours` ;
  (c) confirmation qu'aucun autre endpoint d'écriture de `reservations` ne contourne
  `reservation.service.ts` après refactor (grep + revue).

---

## 8. Migrations (récap, ordre)

1. `working_hours` (table + `idx_working_hours_pro_weekday`) — *dépend de 3.2*.
2. `prestations` : `buffer_before_minutes`, `booking_lead_time_minutes`,
   `booking_horizon_days`, `is_online_bookable` — *3.2*.
3. `unavailabilities` : `start_time TIME`, `end_time TIME` nullable — *3.2*.
4. `reservations` : snapshot (`service_duration_minutes`, `buffer_before_minutes`,
   `buffer_after_minutes`, `blocked_start_datetime`, `blocked_end_datetime`,
   `timezone`) — *3.2*.
5. **`reservations` : colonnes d'override 3.4** (§5.1).
6. Index `reservations(pro_id, status, blocked_start_datetime, blocked_end_datetime)`.
7. Backfill : pour les réservations existantes non terminées, calculer `blocked_*`
   depuis les données actuelles (`start_datetime`/`end_datetime` + `buffer_after`
   prestation) — script idempotent, testé sur copie de prod.

> **Hors périmètre (PR séparée ultérieure)** : contrainte `EXCLUDE USING gist` sur
> `reservations`. À faire seulement après migration complète vers le moteur,
> dépréciation des anciennes routes, et script d'audit des chevauchements existants.

---

## 9. Livrables après validation CTO

- Migrations 5–7 (backend `blyss-app`).
- `backend/services/reservation.service.ts` (nouveau) + extraction
  `withProReservationLock`.
- Refactor `reschedule.service.ts` pour consommer le helper partagé (sans
  régression `reschedule-consent.test.ts`).
- Refactor handlers `POST /api/reservations` et `POST /api/pro/appointments`.
- Tests : `reservation-concurrency.test.ts` (C1–C8), `manual-appointment.test.ts`
  (M1–M9).
- Mobile (`blyss-mobile`) : `lib/api.ts` (`proApi.createAppointment` + override),
  `NewAppointmentSheet.tsx`, `app/(pro)/calendar.tsx` (sélecteur de créneaux
  calculés, toasts, mode dégradé), tests `__tests__/pro/calendar.test.tsx` étendus.

---

## 10. Questions ouvertes pour le CTO

1. **Statut initial** d'un RDV créé par la pro : `confirmed` directement (pas de
   paiement en ligne côté pro) ou `pending` ? Impacte le blocage du créneau.
2. **Walk-in client** : `POST /api/pro/appointments` peut-il créer une cliente
   inexistante, ou exige-t-il un `client_id` déjà au carnet ?
3. **`alternativeSlots`** dans le 409 : acceptable de faire un `getAvailability`
   best-effort après rollback (léger surcoût), ou on renvoie `[]` et le mobile
   recharge lui-même ?
4. **Job d'expiration des `pending`** : existe-t-il déjà, ou fait-il partie de la
   livraison 3.2 ? (Le re-check en dépend pour la relibération.)
