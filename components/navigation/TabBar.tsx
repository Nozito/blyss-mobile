import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
  LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

type TabConfig = {
  name: string;
  label: string;
  activeIcon: string;
  inactiveIcon: string;
};

const CLIENT_TABS: TabConfig[] = [
  { name: "index",         label: "Accueil",  activeIcon: "home",          inactiveIcon: "home-outline" },
  { name: "bookings",      label: "Réservations", activeIcon: "calendar",      inactiveIcon: "calendar-outline" },
  { name: "favorites",     label: "Favoris",  activeIcon: "heart",         inactiveIcon: "heart-outline" },
  { name: "notifications", label: "Notifs",   activeIcon: "notifications", inactiveIcon: "notifications-outline" },
  { name: "(profile)",     label: "Profil",   activeIcon: "person",        inactiveIcon: "person-outline" },
];

const PRO_TABS: TabConfig[] = [
  { name: "dashboard",     label: "Dashboard", activeIcon: "grid",          inactiveIcon: "grid-outline" },
  { name: "calendar",      label: "Agenda",    activeIcon: "calendar",      inactiveIcon: "calendar-outline" },
  { name: "clients",       label: "Clientes",  activeIcon: "people",        inactiveIcon: "people-outline" },
  { name: "notifications", label: "Notifs",    activeIcon: "notifications", inactiveIcon: "notifications-outline" },
  { name: "(profile)",     label: "Profil",    activeIcon: "person",        inactiveIcon: "person-outline" },
];

const TAB_HEIGHT = 64;
const PILL_HEIGHT = 44;
const PILL_PADDING = 10; // horizontal margin inside each slot

function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.15, useNativeDriver: true, speed: 80, bounciness: 8 }),
        Animated.spring(scale, { toValue: 1.0,  useNativeDriver: true, speed: 40, bounciness: 0 }),
      ]).start();
    } else {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
    }
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {/* Wrapper View pour le centrage horizontal — ne pas mettre alignItems sur Animated.View */}
      <View style={{ alignItems: "center" }}>
        <Ionicons
          name={icon as any}
          size={22}
          color={focused ? "#FE5D9D" : "rgba(0,0,0,0.35)"}
        />
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: "#FE5D9D",
            marginTop: 2,
            opacity: focused ? 1 : 0,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

function LiquidTabBarBase({ state, navigation, tabs }: { state: any; navigation: any; tabs: TabConfig[] }) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const pillX = useRef(new Animated.Value(0)).current;

  const activeIndex = tabs.findIndex((t) => t.name === state.routes[state.index]?.name);
  const clampedIndex = activeIndex < 0 ? 0 : activeIndex;

  const tabWidth = barWidth / tabs.length;
  const pillWidth = tabWidth - PILL_PADDING * 2;

  useEffect(() => {
    if (barWidth === 0 || activeIndex < 0) return;
    const target = clampedIndex * tabWidth + PILL_PADDING;
    Animated.spring(pillX, {
      toValue: target,
      useNativeDriver: true,
      stiffness: 180,
      damping: 20,
    }).start();
  }, [clampedIndex, barWidth]);

  if (activeIndex < 0) return null;

  const handleLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  const Inner = (
    <View style={styles.inner} onLayout={handleLayout}>
      {/* Sliding liquid pill */}
      {barWidth > 0 && (
        <Animated.View
          style={[
            styles.pill,
            {
              width: pillWidth,
              height: PILL_HEIGHT,
              transform: [{ translateX: pillX }],
            },
          ]}
        >
          {/* Inner highlight (faux inner shadow) */}
          <View style={styles.pillHighlight} />
        </Animated.View>
      )}

      {/* Tab buttons */}
      {tabs.map((tab) => {
        const route = state.routes.find((r: any) => r.name === tab.name);
        if (!route) return null;
        const focused = state.routes[state.index]?.name === tab.name;
        return (
          <Pressable
            key={tab.name}
            onPress={() => navigation.navigate(tab.name)}
            style={styles.tabButton}
            accessibilityRole="button"
          >
            <TabIcon
              icon={focused ? tab.activeIcon : tab.inactiveIcon}
              label={tab.label}
              focused={focused}
            />
          </Pressable>
        );
      })}
    </View>
  );

  const containerStyle = [
    styles.container,
    { bottom: insets.bottom + 24 },
  ];

  if (Platform.OS === "android") {
    return (
      <View style={[containerStyle, styles.androidFallback]}>
        {Inner}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      {/* Frosted glass base */}
      <View style={styles.frostedBase} />
      <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
      {/* Border overlay */}
      <View style={styles.borderOverlay} />
      {/* Fix 1b — ligne brillante en haut (arête de verre) */}
      <View style={styles.topHighlight} />
      {Inner}
    </View>
  );
}

export function LiquidTabBar(props: any) {
  return <LiquidTabBarBase {...props} tabs={CLIENT_TABS} />;
}

export function ProLiquidTabBar(props: any) {
  return <LiquidTabBarBase {...props} tabs={PRO_TABS} />;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 20,
    right: 20,
    height: TAB_HEIGHT,
    borderRadius: 30,
    overflow: "hidden",
    // Fix 1b — ombre neutre iOS 26 style
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 20,
  },
  androidFallback: {
    backgroundColor: "rgba(255, 240, 245, 0.92)",
  },
  frostedBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    position: "absolute",
    top: (TAB_HEIGHT - PILL_HEIGHT) / 2,
    borderRadius: 22,
    // Fix 1a — pill plus visible
    backgroundColor: "rgba(254, 93, 157, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(254, 93, 157, 0.45)",
    overflow: "hidden",
  },
  pillHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    // Fix 1b — highlight plus haut
    height: 16,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 22,
  },
  // Fix 1b — arête brillante en haut du container (effet verre)
  // Pas de zIndex : évite le stacking context qui cache Inner
  topHighlight: {
    position: "absolute",
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: TAB_HEIGHT,
  },
});
