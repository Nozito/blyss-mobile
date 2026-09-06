import { canShowReservationPin } from "@/lib/reservationPin";

const FUTURE = "2026-12-01T10:00:00.000Z";
const PAST = "2026-01-01T10:00:00.000Z";
const NOW = new Date("2026-06-01T00:00:00.000Z");

describe("canShowReservationPin", () => {
  it("affiche la bannière pour un RDV confirmé à venir", () => {
    expect(canShowReservationPin("confirmed", FUTURE, NOW)).toBe(true);
  });

  it("masque si le RDV est passé", () => {
    expect(canShowReservationPin("confirmed", PAST, NOW)).toBe(false);
  });

  it("masque si annulé, terminé ou no-show", () => {
    expect(canShowReservationPin("cancelled", FUTURE, NOW)).toBe(false);
    expect(canShowReservationPin("completed", FUTURE, NOW)).toBe(false);
    expect(canShowReservationPin("no_show", FUTURE, NOW)).toBe(false);
  });

  it("masque s'il n'y a pas de RDV épinglé", () => {
    expect(canShowReservationPin(null, null, NOW)).toBe(false);
    expect(canShowReservationPin(null, FUTURE, NOW)).toBe(false);
    expect(canShowReservationPin("confirmed", null, NOW)).toBe(false);
  });

  it("masque si la date est illisible", () => {
    expect(canShowReservationPin("confirmed", "pas-une-date", NOW)).toBe(false);
  });

  it("réapparaît dès qu'un nouveau RDV confirmé à venir est épinglé", () => {
    expect(canShowReservationPin("cancelled", PAST, NOW)).toBe(false);
    expect(canShowReservationPin("confirmed", FUTURE, NOW)).toBe(true);
  });
});
