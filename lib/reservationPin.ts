/**
 * Bannière "Voir le rendez-vous correspondant" (fil de messages).
 *
 * Ne s'affiche que si le RDV épinglé est un RDV ACTIF à venir. Masquée
 * quand il est passé, annulé, terminé, no-show, ou inexistant. Elle
 * réapparaît d'elle-même dès que le fil est réépinglé à un nouveau RDV
 * confirmé (le backend met à jour last_reservation_id).
 *
 * Logique isolée ici pour être testable sans monter le composant React.
 */
export function canShowReservationPin(
  status: string | null,
  reservationStart: string | null,
  now: Date = new Date()
): boolean {
  if (status !== "confirmed" || reservationStart === null) return false;
  const start = new Date(reservationStart).getTime();
  if (Number.isNaN(start)) return false;
  return start > now.getTime();
}
