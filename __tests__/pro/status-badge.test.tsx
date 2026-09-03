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

  it("getStatusCfg expose label/color/bg/icon pour chaque statut", () => {
    const cfg = getStatusCfg(new Proxy({}, { get: () => "#000" }) as any);
    for (const [key] of STATUSES) {
      expect(cfg[key]).toEqual(
        expect.objectContaining({ label: expect.any(String), color: expect.any(String), bg: expect.any(String), icon: expect.any(String) })
      );
    }
  });
});
