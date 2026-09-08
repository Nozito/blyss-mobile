/**
 * Filet de sécurité global : une exception au rendu d'un écran affiche un
 * fallback récupérable au lieu de crasher toute l'app (comportement par défaut
 * d'un build release). Le message d'erreur est visible à l'écran pour faciliter
 * le diagnostic terrain, et remonté à Sentry si configuré.
 */
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Sentry from "@sentry/react-native";
import { useThemeColors } from "@/hooks/useThemeColors";

interface Props {
  children: React.ReactNode;
  /** Appelé quand l'utilisateur choisit « Réessayer » — typiquement router.back(). */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const colors = useThemeColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.destructive} />
        <Text style={{ fontSize: 17, fontWeight: "800", color: colors.foreground, textAlign: "center" }}>
          Une erreur est survenue
        </Text>
        <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 19 }}>
          Cet écran n'a pas pu s'afficher. Tu peux réessayer ou revenir en arrière.
        </Text>
        <View style={{ backgroundColor: colors.muted, borderRadius: 10, padding: 12, alignSelf: "stretch" }}>
          <Text selectable style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "monospace" }}>
            {error.message || String(error)}
          </Text>
        </View>
        <Pressable
          onPress={onReset}
          style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 28, marginTop: 4 }}
        >
          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.onColor }}>Réessayer</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
