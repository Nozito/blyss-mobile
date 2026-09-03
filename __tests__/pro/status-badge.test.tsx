import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("@/hooks/useThemeColors", () => ({
  useThemeColors: () => new Proxy({}, { get: (_t, k) => `#${String(k).slice(0, 6)}` }),
}));

import { StatusBadge, getStatusCfg } from "@/components/screens/pro/calendar/StatusBadge";

const STATUSES: [string, string][] = [
  ["completed", "Terminé"],
  ["cancelled", "Annulé"],
  ["pending", "À venir"],
  ["ongoing", "En cours"],
  ["past_pending", "À valider"],
  ["no_show", "Absent"],
];

describe("StatusBadge", () => {
  it.each(STATUSES)("affiche le libellé pour %s", (key, label) => {
    const { getByText } = render(<StatusBadge statusKey={key} variant="inline" />);
    expect(getByText(label)).toBeTruthy();
  });

  it("statut inconnu → retombe sur 'À venir'", () => {
    const { getByText } = render(<StatusBadge statusKey="wat" variant="pill" />);
    expect(getByText("À venir")).toBeTruthy();
  });

  it("getStatusCfg expose label/color/bg/icon/role pour chaque statut", () => {
    const cfg = getStatusCfg(new Proxy({}, { get: () => "#000" }) as any);
    for (const [key] of STATUSES) {
      expect(cfg[key]).toEqual(
        expect.objectContaining({
          label: expect.any(String), color: expect.any(String), bg: expect.any(String),
          icon: expect.any(String), role: expect.stringMatching(/^(primary|neutral|alert)$/),
        })
      );
    }
  });

  it("rôle alert : texte foncé sur fond clair (contraste AA)", () => {
    const colors: any = { warningTextDark: "#B45309", warningLight: "#FFF7ED", primary: "#p", mutedForeground: "#m", muted: "#mm" };
    const cfg = getStatusCfg(colors);
    expect(cfg.no_show.color).toBe("#B45309");
    expect(cfg.no_show.bg).toBe("#FFF7ED");
  });

  it("mapping sur 3 rôles", () => {
    const cfg = getStatusCfg(new Proxy({}, { get: () => "#000" }) as any);
    expect(cfg.ongoing.role).toBe("primary");
    expect(cfg.pending.role).toBe("neutral");
    expect(cfg.completed.role).toBe("neutral");
    expect(cfg.cancelled.role).toBe("neutral");
    expect(cfg.past_pending.role).toBe("alert");
    expect(cfg.no_show.role).toBe("alert");
  });

  it("distinction non chromatique : barré pour Annulé, atténué pour Terminé", () => {
    const cfg = getStatusCfg(new Proxy({}, { get: () => "#000" }) as any);
    expect(cfg.cancelled.strikethrough).toBe(true);
    expect(cfg.completed.dim).toBe(true);
    // chaque statut a une icône propre
    const icons = STATUSES.map(([k]) => cfg[k].icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
