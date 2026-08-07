import { hasPlanAtLeast, PLAN_RANK } from "@/constants/plans";
import type { RCPlan } from "@/contexts/RevenueCatContext";

describe("hasPlanAtLeast", () => {
  it("no active plan never satisfies any minimum", () => {
    expect(hasPlanAtLeast(null, "start")).toBe(false);
    expect(hasPlanAtLeast(null, "signature")).toBe(false);
  });

  it("a plan satisfies its own tier and every tier below it", () => {
    expect(hasPlanAtLeast("serenite", "start")).toBe(true);
    expect(hasPlanAtLeast("serenite", "serenite")).toBe(true);
  });

  it("a plan does not satisfy a tier above it", () => {
    expect(hasPlanAtLeast("start", "serenite")).toBe(false);
    expect(hasPlanAtLeast("serenite", "signature")).toBe(false);
  });

  it("signature satisfies every tier", () => {
    (Object.keys(PLAN_RANK) as RCPlan[]).forEach((min) => {
      expect(hasPlanAtLeast("signature", min)).toBe(true);
    });
  });

  it("hierarchy is strictly increasing Start < Sérénité < Signature", () => {
    expect(PLAN_RANK.start).toBeLessThan(PLAN_RANK.serenite);
    expect(PLAN_RANK.serenite).toBeLessThan(PLAN_RANK.signature);
  });
});
