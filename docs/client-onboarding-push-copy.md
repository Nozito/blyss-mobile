# Onboarding client nails — copies push (#34)

Notifications de relance pour les clients qui n'ont **pas terminé** l'onboarding
ou **pas pris de premier RDV**. Envoi orchestré côté backend (#34 PR 1/3, cron).
Le mobile ne fait que recevoir (`expo-notifications`, déjà branché).

Règles : 1 push max par palier, jamais après un RDV pris, respect du quiet time
(pas avant 9 h / après 20 h heure locale), stop si `onboarding_skipped` deux fois.

| Palier | Segment | Titre | Corps | Deep link |
|---|---|---|---|---|
| **J+1** | onboarding non terminé | Ta pro nails t'attend 💅 | On a trouvé des prothésistes ongulaires près de chez toi. Regarde en 30 s. | `blyss://client-onboarding?from=push_j1` |
| **J+3** | préférences faites, aucun RDV | {N} créneaux cette semaine près de toi | {Pro} a de la place pour {style}. Réserve avant que ça parte. | `blyss://specialist/{pro_id}?from=push_j3` |
| **J+7** | toujours aucun RDV | Prête à te faire les ongles ? | Réserve en quelques taps, 24/7, avec des pros vérifiées. | `blyss://client-onboarding?from=push_j7` |

### Variantes A/B (titre J+3)

- A — rareté : « {N} créneaux cette semaine près de toi »
- B — preuve sociale : « {Pro} est très demandée en ce moment »

### Ton

Tutoiement, court, concret, une seule action. Pas d'emoji dans le corps (titre
uniquement, 1 max). Pas d'offre promo (Blyss ne la prend pas en charge).

### Tracking

À l'ouverture depuis un push : `posthog.capture('onboarding_resumed', { source })`
avec `source = push_j1 | push_j3 | push_j7` (déjà géré via `?from=` dans
`client-onboarding.tsx`).
