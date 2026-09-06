import type { Ionicons } from "@expo/vector-icons";
import type { ImageSourcePropType } from "react-native";
import { withAlpha } from "@/constants/colors";
import type { useThemeColors } from "@/hooks/useThemeColors";
import type { RCPlan } from "@/contexts/RevenueCatContext";
import type { FieldTone } from "@/components/onboarding/kit";

type ThemeColors = ReturnType<typeof useThemeColors>;

export type OnboardingSlide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  /** Accent du palier (rose / violet Pro / doré Signature) — badge + fallback icône. */
  color: string;
  bg: string;
  /** Fond « poster » du slide dans le carrousel pro. */
  tone: FieldTone;
  /** Libellé du palier affiché en pastille quand le slide en débloque un. */
  tierLabel?: string;
  /**
   * Mockup/capture de la fonctionnalité, affiché en plein cadre sur le
   * slide du carrousel d'onboarding. Non renseigné pour l'instant — le
   * carrousel retombe alors sur un cadre avec l'icône, prêt à recevoir un
   * vrai visuel (ex: image: require("@/assets/onboarding/portfolio.png")).
   */
  image?: ImageSourcePropType;
};

const TIER_ORDER: RCPlan[] = ["start", "serenite", "signature"];

function getBaseSlides(colors: ThemeColors): OnboardingSlide[] {
  return [
    {
      icon: "calendar-outline",
      title: "Ton agenda pro",
      description:
        "Crée tes créneaux, accepte les réservations en ligne. Fini les allers-retours par messages.",
      color: colors.primary,
      bg: colors.primaryLight,
      tone: "rose",
      image: require("@/assets/onboarding/agenda.png"),
    },
    {
      icon: "people-outline",
      title: "Tes clientes",
      description:
        "Retrouve l'historique de chaque cliente, ses préférences et tes notes en un seul endroit.",
      color: colors.primary,
      bg: colors.primaryLight,
      tone: "rose",
      image: require("@/assets/onboarding/clients.png"),
    },
    {
      icon: "card-outline",
      title: "Paiement en ligne sécurisé",
      description:
        "Tes clientes payent directement dans l'app. Plus d'espèces à gérer, plus d'oublis à relancer.",
      color: colors.primary,
      bg: colors.primaryLight,
      tone: "rose",
    },
  ];
}

// Un ou plusieurs slides par palier — affichés uniquement quand ce palier
// vient d'être débloqué (première souscription qui l'atteint, ou upgrade qui
// le franchit). "start" n'a pas de slide dédié : ses fonctionnalités sont
// couvertes par les slides de base.
function getTierSlides(colors: ThemeColors): Partial<Record<RCPlan, OnboardingSlide[]>> {
  return {
    serenite: [
      {
        icon: "heart-outline",
        title: "Attire et fidélise tes clientes",
        description:
          "Un portfolio photo pour attirer de nouvelles clientes et des rappels post-prestation pour les fidéliser.",
        color: colors.pro,
        bg: withAlpha(colors.pro, 0.12),
        tone: "cream",
        tierLabel: "Sérénité",
        image: require("@/assets/onboarding/portfolio.png"),
      },
      {
        icon: "stats-chart-outline",
        title: "Statistiques détaillées",
        description: "Suis la performance de ton activité, semaine après semaine.",
        color: colors.pro,
        bg: withAlpha(colors.pro, 0.12),
        tone: "cream",
        tierLabel: "Sérénité",
        image: require("@/assets/onboarding/stats.png"),
      },
    ],
    signature: [
      {
        icon: "trending-up-outline",
        title: "Anticipe ton activité",
        description:
          "Prévision de ton chiffre d'affaires, rapports automatiques chaque semaine et synchronisation avec ton Apple Calendar.",
        color: colors.secondary,
        bg: colors.secondaryLight,
        tone: "prune",
        tierLabel: "Signature",
        image: require("@/assets/onboarding/finance.png"),
      },
      {
        icon: "pulse-outline",
        title: "Analyses de performance",
        description: "Comprends ce qui marche dans ton activité pour progresser plus vite.",
        color: colors.secondary,
        bg: colors.secondaryLight,
        tone: "prune",
        tierLabel: "Signature",
        image: require("@/assets/onboarding/analytics.png"),
      },
    ],
  };
}

function closingSlide(isUpgrade: boolean, colors: ThemeColors): OnboardingSlide {
  return isUpgrade
    ? {
        icon: "rocket-outline",
        title: "Fonctionnalités activées",
        description: "Elles sont disponibles dès maintenant dans ton espace pro.",
        color: colors.primary,
        bg: colors.primaryLight,
        tone: "cream",
      }
    : {
        icon: "rocket-outline",
        title: "Ton compte Pro est prêt",
        description:
          "Commence à recevoir des réservations dès aujourd'hui. 1 rendez-vous rembourse ton abonnement.",
        color: colors.primary,
        bg: colors.primaryLight,
        tone: "rose",
        image: require("@/assets/onboarding/ready.png"),
      };
}

/**
 * `previousPlan` null → toute première souscription : slides de base +
 * slides de chaque palier atteint par `plan`.
 * `previousPlan` renseigné → changement de formule : uniquement les slides
 * des paliers nouvellement franchis entre `previousPlan` (exclu) et `plan`.
 */
export function buildOnboardingSlides(
  plan: RCPlan,
  previousPlan: RCPlan | null,
  colors: ThemeColors
): OnboardingSlide[] {
  const isFirstSubscription = previousPlan === null;
  const slides: OnboardingSlide[] = [];

  if (isFirstSubscription) slides.push(...getBaseSlides(colors));

  const fromIndex = isFirstSubscription ? -1 : TIER_ORDER.indexOf(previousPlan);
  const toIndex = TIER_ORDER.indexOf(plan);
  const tierSlidesByPlan = getTierSlides(colors);

  for (let i = Math.max(fromIndex + 1, 1); i <= toIndex; i++) {
    const tierSlides = tierSlidesByPlan[TIER_ORDER[i]];
    if (tierSlides) slides.push(...tierSlides);
  }

  slides.push(closingSlide(!isFirstSubscription, colors));
  return slides;
}

/** Y a-t-il quoi que ce soit de nouveau à montrer pour ce changement de plan ? */
export function hasNewFeatures(plan: RCPlan, previousPlan: RCPlan | null): boolean {
  if (previousPlan === null) return true;
  return TIER_ORDER.indexOf(plan) > TIER_ORDER.indexOf(previousPlan);
}
