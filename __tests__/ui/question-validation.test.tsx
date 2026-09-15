/**
 * Tests — validation des questions personnalisées côté cliente (moteur V2).
 * Réf : docs/ARCHITECTURE_MOTEUR_PRESTATIONS_V1_V3.md (§14.2, §21).
 * Logique pure de PrestationConfigurator.tsx — pas de rendu, uniquement les
 * règles de validation qui bloquent/débloquent le bouton "Continuer".
 * (.tsx car le module importe react-native — cf. jest.rn.config.js.)
 */

import { isQuestionsComplete } from "@/components/screens/client/booking/PrestationConfigurator";
import type { Question } from "@/types/prestation";
import type { ReservationAnswerSelection } from "@/types/reservation";

function question(overrides: Partial<Question>): Question {
  return {
    id: 1,
    prestation_id: 10,
    label: "Question test",
    type: "short_text",
    required: false,
    active: true,
    is_sensitive: false,
    sort_order: 0,
    ...overrides,
  };
}

describe("isQuestionsComplete", () => {
  it("aucune question = toujours complet (rétrocompatibilité)", () => {
    expect(isQuestionsComplete([], {})).toBe(true);
  });

  it("question facultative sans réponse = complet", () => {
    const q = question({ required: false });
    expect(isQuestionsComplete([q], {})).toBe(true);
  });

  it("question requise sans réponse = incomplet", () => {
    const q = question({ required: true, type: "short_text" });
    expect(isQuestionsComplete([q], {})).toBe(false);
  });

  it("short_text requise avec réponse vide (espaces) = incomplet", () => {
    const q = question({ id: 1, required: true, type: "short_text" });
    const answers: Record<number, ReservationAnswerSelection> = { 1: { questionId: 1, value: "   " } };
    expect(isQuestionsComplete([q], answers)).toBe(false);
  });

  it("short_text requise avec réponse non vide = complet", () => {
    const q = question({ id: 1, required: true, type: "short_text" });
    const answers: Record<number, ReservationAnswerSelection> = { 1: { questionId: 1, value: "Ongles courts" } };
    expect(isQuestionsComplete([q], answers)).toBe(true);
  });

  it("boolean requise nécessite 'true' ou 'false' explicite", () => {
    const q = question({ id: 1, required: true, type: "boolean" });
    expect(isQuestionsComplete([q], {})).toBe(false);
    expect(isQuestionsComplete([q], { 1: { questionId: 1, value: "true" } })).toBe(true);
    expect(isQuestionsComplete([q], { 1: { questionId: 1, value: "false" } })).toBe(true);
  });

  it("single_choice requise nécessite exactement une valeur sélectionnée", () => {
    const q = question({ id: 1, required: true, type: "single_choice" });
    expect(isQuestionsComplete([q], { 1: { questionId: 1, values: [] } })).toBe(false);
    expect(isQuestionsComplete([q], { 1: { questionId: 1, values: [100] } })).toBe(true);
  });

  it("multi_choice requise nécessite au moins une valeur sélectionnée", () => {
    const q = question({ id: 1, required: true, type: "multi_choice" });
    expect(isQuestionsComplete([q], { 1: { questionId: 1, values: [] } })).toBe(false);
    expect(isQuestionsComplete([q], { 1: { questionId: 1, values: [100, 101] } })).toBe(true);
  });

  it("question sensible avec contenu mais sans consentement = incomplet, même facultative", () => {
    const q = question({ id: 1, required: false, is_sensitive: true, type: "short_text" });
    const answers: Record<number, ReservationAnswerSelection> = { 1: { questionId: 1, value: "Allergie X", consent: false } };
    expect(isQuestionsComplete([q], answers)).toBe(false);
  });

  it("question sensible avec contenu et consentement explicite = complet", () => {
    const q = question({ id: 1, required: false, is_sensitive: true, type: "short_text" });
    const answers: Record<number, ReservationAnswerSelection> = { 1: { questionId: 1, value: "Allergie X", consent: true } };
    expect(isQuestionsComplete([q], answers)).toBe(true);
  });

  it("question sensible facultative SANS réponse = complet (le consentement n'est requis que si elle répond)", () => {
    const q = question({ id: 1, required: false, is_sensitive: true, type: "short_text" });
    expect(isQuestionsComplete([q], {})).toBe(true);
  });

  it("une question inactive n'est jamais bloquante, même requise", () => {
    const q = question({ id: 1, required: true, active: false, type: "short_text" });
    expect(isQuestionsComplete([q], {})).toBe(true);
  });

  it("plusieurs questions : toutes doivent être valides", () => {
    const q1 = question({ id: 1, required: true, type: "boolean" });
    const q2 = question({ id: 2, required: true, type: "short_text" });
    const answers: Record<number, ReservationAnswerSelection> = { 1: { questionId: 1, value: "true" } };
    expect(isQuestionsComplete([q1, q2], answers)).toBe(false); // q2 sans réponse
    answers[2] = { questionId: 2, value: "ok" };
    expect(isQuestionsComplete([q1, q2], answers)).toBe(true);
  });
});
