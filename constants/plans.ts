// Source unique pour les métadonnées des plans Pro (label, icône, couleur, prix
// de repli, fonctionnalités) — évite la duplication entre l'écran Abonnement
// (choix/gestion du plan) et l'écran Upgrade (mur de fonctionnalité verrouillée).
import type { Ionicons } from "@expo/vector-icons";
import type { useThemeColors } from "@/hooks/useThemeColors";
import type { RCPlan } from "@/contexts/RevenueCatContext";

export interface PlanFeature {
  text: string;
  icon: string;
}

export interface PlanDefinition {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  fallbackMonthly: number;
  fallbackAnnualTotal: number;
  /** Résumé court, utilisé sur l'écran de gestion d'abonnement. */
  description: string;
  /** Liste complète, utilisée sur l'écran Abonnement (pitch marketing détaillé). */
  features: PlanFeature[];
  /** Liste condensée, utilisée sur l'écran Upgrade (mur de fonctionnalité). */
  upgradeFeatures: string[];
}

/** Hiérarchie des paliers — doit rester alignée avec PLAN_RANK côté backend (server.ts). */
export const PLAN_RANK: Record<RCPlan, number> = { start: 1, serenite: 2, signature: 3 };

/** True si `activePlan` couvre au moins `min` dans la hiérarchie Start < Sérénité < Signature. */
export function hasPlanAtLeast(activePlan: RCPlan | null, min: RCPlan): boolean {
  if (!activePlan) return false;
  return PLAN_RANK[activePlan] >= PLAN_RANK[min];
}

export function getPlanDefinitions(
  colors: ReturnType<typeof useThemeColors>
): Record<RCPlan, PlanDefinition> {
  return {
    start: {
      label: "Start",
      icon: "rocket-outline",
      color: colors.primary,
      fallbackMonthly: 29.99,
      fallbackAnnualTotal: 299.99,
      description: "Réservations & agenda",
      features: [
        { text: "Réservations en ligne", icon: "calendar-outline" },
        { text: "Rappels automatiques — zéro lapin", icon: "notifications-outline" },
        { text: "Profil public visible par toutes tes clientes", icon: "globe-outline" },
        { text: "Dashboard de suivi", icon: "bar-chart-outline" },
        { text: "Paiement en ligne sécurisé", icon: "card-outline" },
        { text: "CA en temps réel", icon: "trending-up-outline" },
      ],
      upgradeFeatures: ["Réservations en ligne", "Dashboard de suivi", "Profil public", "CA en temps réel"],
    },
    serenite: {
      label: "Sérénité",
      icon: "shield-checkmark-outline",
      color: colors.pro,
      fallbackMonthly: 39.99,
      fallbackAnnualTotal: 399.99,
      description: "Portfolio & statistiques",
      features: [
        { text: "Tout Start inclus", icon: "checkmark-circle-outline" },
        { text: "Portfolio photos pour attirer de nouvelles clientes", icon: "camera-outline" },
        { text: "Export des données (CSV / Excel)", icon: "download-outline" },
        { text: "Statistiques détaillées de ton activité", icon: "analytics-outline" },
        { text: "Rappels post-prestation pour fidéliser", icon: "heart-outline" },
      ],
      upgradeFeatures: ["Tout Start inclus", "Portfolio photos", "Export CSV / Excel", "Statistiques détaillées"],
    },
    signature: {
      label: "Signature",
      icon: "diamond-outline",
      color: colors.secondary,
      fallbackMonthly: 49.99,
      fallbackAnnualTotal: 499.99,
      description: "Pilotage & support premium",
      features: [
        { text: "Tout Sérénité inclus", icon: "checkmark-circle-outline" },
        { text: "Synchronisation Apple Calendar", icon: "calendar-clear-outline" },
        { text: "Rapports automatiques (hebdo / mensuels)", icon: "document-text-outline" },
        { text: "Prévision du chiffre d'affaires", icon: "trending-up-outline" },
        { text: "Analyses de performance", icon: "speedometer-outline" },
        { text: "Support prioritaire", icon: "headset-outline" },
      ],
      upgradeFeatures: ["Tout Sérénité inclus", "Rapports automatiques", "Prévision du CA", "Support prioritaire"],
    },
  };
}
