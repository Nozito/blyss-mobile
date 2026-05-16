import React from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
    <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
      {/* Back + title + toggle */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 20 }}>
        <Pressable
          onPress={onBack}
          style={{
            width: 40,
            height: 40,
            borderRadius: 16,
            backgroundColor: "#F8F5F1",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name="chevron-back" size={20} color="#09090B" />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#09090B", lineHeight: 22 }}>
            Expertes ongulaires
          </Text>
          <Text style={{ fontSize: 12, color: "#6D6D78", marginTop: 2 }}>
            {isFetching
              ? "Recherche en cours…"
              : `${count} experte${count > 1 ? "s" : ""} trouvée${count > 1 ? "s" : ""}`}
          </Text>
        </View>

        {/* Liste / Carte toggle */}
        <Pressable
          onPress={onToggleView}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: viewMode === "map" ? "#FE5D9D" : "#F8F5F1",
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
            color={viewMode === "map" ? "#fff" : "#09090B"}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: viewMode === "map" ? "#fff" : "#09090B",
            }}
          >
            {viewMode === "list" ? "Carte" : "Liste"}
          </Text>
        </Pressable>
      </View>

      {/* Search bar — hidden in map mode to maximise map space */}
      {viewMode === "list" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 48,
            borderRadius: 16,
            backgroundColor: "#F8F5F1",
            paddingHorizontal: 16,
            gap: 10,
            marginBottom: 16,
          }}
        >
          {isFetching ? (
            <ActivityIndicator size="small" color="#FE5D9D" />
          ) : (
            <Ionicons name="search-outline" size={16} color="#6D6D78" />
          )}
          <TextInput
            value={searchInput}
            onChangeText={onChangeText}
            placeholder="Nom, spécialité, ville…"
            placeholderTextColor="#6D6D78"
            style={{ flex: 1, fontSize: 14, color: "#09090B" }}
            autoCorrect={false}
          />
          {searchInput.length > 0 && (
            <Pressable
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
              <Ionicons name="close" size={12} color="#09090B" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
