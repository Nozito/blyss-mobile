import React, { useCallback } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

const SERVICE_CHIPS = [
  { label: "Gel", query: "gel" },
  { label: "Manucure", query: "manucure" },
  { label: "French", query: "french" },
  { label: "Nail art", query: "nail art" },
  { label: "Semi-perm.", query: "semi-permanent" },
  { label: "Baby boomer", query: "baby boomer" },
];
const RATING_OPTIONS = [
  { label: "4+", value: 4 },
  { label: "4.5+", value: 4.5 },
];

type ChipData =
  | { type: "rating"; value: number; label: string; key: string }
  | { type: "city"; key: string }
  | { type: "service"; query: string; label: string; key: string };

const CHIPS: ChipData[] = [
  ...RATING_OPTIONS.map((r) => ({
    type: "rating" as const,
    value: r.value,
    label: r.label,
    key: `rating-${r.value}`,
  })),
  { type: "city" as const, key: "city" },
  ...SERVICE_CHIPS.map((s) => ({
    type: "service" as const,
    query: s.query,
    label: s.label,
    key: `service-${s.query}`,
  })),
];

interface Props {
  ratingFilter: number;
  onRatingChange: (value: number) => void;
  cityFilter: string;
  showCityPanel: boolean;
  onCityToggle: () => void;
  onCitySelect: (city: string) => void;
  uniqueCities: string[];
  serviceFilter: string;
  onServiceChange: (query: string) => void;
  hasActiveFilters: boolean;
  activeFiltersCount: number;
  onClearAll: () => void;
}

function Chip({
  active,
  onPress,
  label,
  children,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filtre ${label}${active ? ", sélectionné" : ""}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 36,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: active ? Colors.primary : Colors.cream,
        flexShrink: 0,
      }}
    >
      {children}
    </Pressable>
  );
}

export function FilterBar({
  ratingFilter,
  onRatingChange,
  cityFilter,
  showCityPanel,
  onCityToggle,
  onCitySelect,
  uniqueCities,
  serviceFilter,
  onServiceChange,
  hasActiveFilters,
  activeFiltersCount,
  onClearAll,
}: Props) {
  const renderChip = useCallback(
    ({ item }: { item: ChipData }) => {
      if (item.type === "rating") {
        const active = ratingFilter === item.value;
        return (
          <Chip active={active} onPress={() => onRatingChange(active ? 0 : item.value)} label={item.label}>
            <Ionicons name="star" size={12} color={active ? Colors.white : "#FBBF24"} />
            <Text style={{ fontSize: 13, fontWeight: "500", color: active ? Colors.white : Colors.foreground }}>
              {item.label}
            </Text>
          </Chip>
        );
      }

      if (item.type === "city") {
        const active = !!cityFilter;
        const cityLabel = cityFilter || "Ville";
        return (
          <Chip active={active} onPress={onCityToggle} label={cityLabel}>
            <Ionicons name="location-outline" size={13} color={active ? Colors.white : Colors.foreground} />
            <Text style={{ fontSize: 13, fontWeight: "500", color: active ? Colors.white : Colors.foreground }}>
              {cityLabel}
            </Text>
          </Chip>
        );
      }

      // service
      const active = serviceFilter === item.query;
      return (
        <Chip active={active} onPress={() => onServiceChange(active ? "" : item.query)} label={item.label}>
          {active && <Ionicons name="checkmark" size={12} color={Colors.white} />}
          <Text style={{ fontSize: 13, fontWeight: "500", color: active ? Colors.white : Colors.foreground }}>
            {item.label}
          </Text>
        </Chip>
      );
    },
    [ratingFilter, cityFilter, serviceFilter, onRatingChange, onCityToggle, onServiceChange]
  );

  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Chips */}
      <FlatList
        data={CHIPS}
        keyExtractor={(item) => item.key}
        renderItem={renderChip}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        style={{ marginBottom: 4 }}
      />

      {/* City panel */}
      {showCityPanel && uniqueCities.length > 0 && (
        <View style={{ paddingTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {["", ...uniqueCities].map((city) => {
            const active = !city ? !cityFilter : cityFilter === city;
            const chipLabel = city || "Toutes les villes";
            return (
              <Chip
                key={city || "__all"}
                active={active}
                onPress={() => onCitySelect(city === cityFilter ? "" : city)}
                label={chipLabel}
              >
                <Text style={{ fontSize: 13, fontWeight: "500", color: active ? Colors.white : Colors.foreground }}>
                  {chipLabel}
                </Text>
              </Chip>
            );
          })}
        </View>
      )}

      {/* Active filters summary */}
      {hasActiveFilters && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
            {activeFiltersCount > 0
              ? `${activeFiltersCount} filtre${activeFiltersCount > 1 ? "s" : ""} actif${activeFiltersCount > 1 ? "s" : ""}`
              : "Filtres actifs"}
          </Text>
          <Pressable
            onPress={onClearAll}
            accessibilityRole="button"
            accessibilityLabel="Effacer tous les filtres"
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Ionicons name="close" size={10} color={Colors.primary} />
            <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: "600" }}>Tout effacer</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
