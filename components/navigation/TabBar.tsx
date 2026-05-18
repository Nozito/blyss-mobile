import React, { useRef, useEffect, useState } from "react";
import {
  View,
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
  activeIcon: string;
  inactiveIcon: string;
};

const CLIENT_TABS: TabConfig[] = [
  { name: "index",         activeIcon: "home",          inactiveIcon: "home-outline" },
  { name: "bookings",      activeIcon: "calendar",      inactiveIcon: "calendar-outline" },
  { name: "favorites",     activeIcon: "heart",         inactiveIcon: "heart-outline" },
  { name: "notifications", activeIcon: "notifications", inactiveIcon: "notifications-outline" },
  { name: "(profile)",     activeIcon: "person",        inactiveIcon: "person-outline" },
];

const PRO_TABS: TabConfig[] = [
  { name: "dashboard",     activeIcon: "grid",          inactiveIcon: "grid-outline" },
  { name: "calendar",      activeIcon: "calendar",      inactiveIcon: "calendar-outline" },
  { name: "clients",       activeIcon: "people",        inactiveIcon: "people-outline" },
  { name: "notifications", activeIcon: "notifications", inactiveIcon: "notifications-outline" },
  { name: "(profile)",     activeIcon: "person",        inactiveIcon: "person-outline" },
];

const TAB_HEIGHT = 64;
const PILL_HEIGHT = 44;
const PILL_PADDING = 10; // horizontal margin inside each slot

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
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
      <Ionicons
        name={icon as any}
        size={22}
        color={focused ? "#FE5D9D" : "rgba(0,0,0,0.35)"}
      />
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
    shadowColor: "#FE5D9D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
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
    backgroundColor: "rgba(254, 93, 157, 0.13)",
    borderWidth: 1,
    borderColor: "rgba(254, 93, 157, 0.28)",
    overflow: "hidden",
  },
  pillHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 22,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: TAB_HEIGHT,
  },
});
