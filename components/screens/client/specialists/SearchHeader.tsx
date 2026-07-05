import React from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
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
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 0 }}>
      {/* Back + title + toggle */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 20 }}>
        <AnimatedIconButton
          onPress={onBack}
          style={{
            width: 40,
            height: 40,
            borderRadius: 16,
            backgroundColor: Colors.cream,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
        </AnimatedIconButton>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, lineHeight: 22 }}>
            Expertes ongulaires
          </Text>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
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
            backgroundColor: viewMode === "map" ? Colors.primary : Colors.cream,
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
            color={viewMode === "map" ? Colors.white : Colors.foreground}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: viewMode === "map" ? Colors.white : Colors.foreground,
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
            backgroundColor: Colors.cream,
            paddingHorizontal: 16,
            gap: 10,
            marginBottom: 16,
          }}
        >
          {isFetching ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="search-outline" size={16} color={Colors.mutedForeground} />
          )}
          <TextInput
            value={searchInput}
            onChangeText={onChangeText}
            placeholder="Nom, spécialité, ville…"
            placeholderTextColor={Colors.mutedForeground}
            style={{ flex: 1, fontSize: 14, color: Colors.foreground }}
            autoCorrect={false}
          />
          {searchInput.length > 0 && (
            <AnimatedIconButton
              onPress={() => onChangeText("")}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#09090B1A",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={12} color={Colors.foreground} />
            </AnimatedIconButton>
          )}
        </View>
      )}
    </View>
  );
}
