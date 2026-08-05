import React from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";

export type ViewMode = "list" | "map";

interface Props {
  searchInput: string;
  onChangeText: (text: string) => void;
  onBack: () => void;
  count: number;
  isFetching: boolean;
  viewMode: ViewMode;
  onToggleView: () => void;
}

export function SearchHeader({
  searchInput,
  onChangeText,
  onBack,
  count,
  isFetching,
  viewMode,
  onToggleView,
}: Props) {
  const colors = useThemeColors();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 0 }}>
      {/* Back + title + toggle */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 20 }}>
        <AnimatedIconButton
          onPress={onBack}
          accessibilityLabel="Retour"
          style={{
            width: 40,
            height: 40,
            borderRadius: 16,
            backgroundColor: colors.cream,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </AnimatedIconButton>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, lineHeight: 22 }}>
            Expertes ongulaires
          </Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
            {isFetching
              ? "Recherche en cours…"
              : `${count} experte${count > 1 ? "s" : ""} trouvée${count > 1 ? "s" : ""}`}
          </Text>
        </View>

        {/* Liste / Carte toggle */}
        <AnimatedPressable
          onPress={onToggleView}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: viewMode === "map" ? colors.primary : colors.cream,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexShrink: 0,
          }}
          accessibilityLabel={viewMode === "list" ? "Passer en vue carte" : "Passer en vue liste"}
        >
          <Ionicons
            name={viewMode === "list" ? "map-outline" : "list-outline"}
            size={16}
            color={viewMode === "map" ? "#FFFFFF" : colors.foreground}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: viewMode === "map" ? "#FFFFFF" : colors.foreground,
            }}
          >
            {viewMode === "list" ? "Carte" : "Liste"}
          </Text>
        </AnimatedPressable>
      </View>

      {/* Search bar — hidden in map mode to maximise map space */}
      {viewMode === "list" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 48,
            borderRadius: 16,
            backgroundColor: colors.cream,
            paddingHorizontal: 16,
            gap: 10,
            marginBottom: 16,
          }}
        >
          {isFetching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          )}
          <TextInput
            value={searchInput}
            onChangeText={onChangeText}
            placeholder="Nom, spécialité, ville…"
            placeholderTextColor={colors.mutedForeground}
            style={{ flex: 1, fontSize: 14, color: colors.foreground }}
            autoCorrect={false}
          />
          {searchInput.length > 0 && (
            <AnimatedIconButton
              onPress={() => onChangeText("")}
              accessibilityLabel="Effacer la recherche"
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: withAlpha(colors.foreground, 0.10),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={12} color={colors.foreground} />
            </AnimatedIconButton>
          )}
        </View>
      )}
    </View>
  );
}
