/**
 * Formatage FR déterministe (lib/format) — indépendant du support Intl d'Hermes.
 */
import { formatEUR, formatNumberFR, formatPercentFR } from "@/lib/format";

const NBSP = String.fromCharCode(0x00a0);

describe("formatNumberFR", () => {
  it("groupe les milliers avec une espace insécable", () => {
    expect(formatNumberFR(1041)).toBe(`1${NBSP}041`);
    expect(formatNumberFR(12345678)).toBe(`12${NBSP}345${NBSP}678`);
    expect(formatNumberFR(999)).toBe("999");
    expect(formatNumberFR(0)).toBe("0");
  });
  it("arrondit et gère le signe", () => {
    expect(formatNumberFR(1234.7)).toBe(`1${NBSP}235`);
    expect(formatNumberFR(-4200)).toBe(`-4${NBSP}200`);
  });
  it("accepte une chaîne et renvoie — si invalide", () => {
    expect(formatNumberFR("3470")).toBe(`3${NBSP}470`);
    expect(formatNumberFR(null)).toBe("—");
    expect(formatNumberFR(undefined)).toBe("—");
    expect(formatNumberFR("abc")).toBe("—");
  });
});

describe("formatEUR", () => {
  it("deux décimales par défaut — chiffres financiers, jamais arrondis", () => {
    expect(formatEUR(3470)).toBe(`3${NBSP}470,00${NBSP}€`);
    expect(formatEUR(49.99)).toBe(`49,99${NBSP}€`);
    expect(formatEUR(133.33)).toBe(`133,33${NBSP}€`);
    expect(formatEUR(0)).toBe(`0,00${NBSP}€`);
  });
  it("cents:false pour l'arrondi à l'euro (affichage compact)", () => {
    expect(formatEUR(3470.4, { cents: false })).toBe(`3${NBSP}470${NBSP}€`);
  });
  it("gros montant groupé", () => {
    expect(formatEUR(12345678.9)).toBe(`12${NBSP}345${NBSP}678,90${NBSP}€`);
    expect(formatEUR(1234.5)).toBe(`1${NBSP}234,50${NBSP}€`);
  });
  it("renvoie — si absent", () => {
    expect(formatEUR(null)).toBe("—");
    expect(formatEUR(undefined)).toBe("—");
  });
});

describe("formatPercentFR", () => {
  it("virgule décimale et espace insécable avant %", () => {
    expect(formatPercentFR(64)).toBe(`64${NBSP}%`);
    expect(formatPercentFR(8.8, 1)).toBe(`8,8${NBSP}%`);
  });
});
