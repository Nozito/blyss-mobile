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
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";

type TabConfig = {
  name: string;
  label: string;
  activeIcon: string;
  inactiveIcon: string;
};

const CLIENT_TABS: TabConfig[] = [
  { name: "index",         label: "Accueil",      activeIcon: "home",          inactiveIcon: "home-outline" },
  { name: "bookings",      label: "Réservations", activeIcon: "calendar",      inactiveIcon: "calendar-outline" },
  { name: "favorites",     label: "Favoris",      activeIcon: "heart",         inactiveIcon: "heart-outline" },
  { name: "notifications", label: "Notifs",       activeIcon: "notifications", inactiveIcon: "notifications-outline" },
  { name: "(profile)",     label: "Profil",       activeIcon: "person",        inactiveIcon: "person-outline" },
];

const PRO_TABS: TabConfig[] = [
  { name: "dashboard",     label: "Dashboard",  activeIcon: "grid",          inactiveIcon: "grid-outline" },
  { name: "calendar",      label: "Agenda",     activeIcon: "calendar",      inactiveIcon: "calendar-outline" },
  { name: "clients",       label: "Clientes",   activeIcon: "people",        inactiveIcon: "people-outline" },
  { name: "notifications", label: "Notifs",     activeIcon: "notifications", inactiveIcon: "notifications-outline" },
  { name: "(profile)",     label: "Profil",     activeIcon: "person",        inactiveIcon: "person-outline" },
];

const TAB_HEIGHT = 64;
const BALL_SIZE  = 52;

function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  const scale   = useRef(new Animated.Value(focused ? 1.05 : 1)).current;
  const opacity = useRef(new Animated.Value(focused ? 1 : 0.40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: focused ? 1.05 : 1,   useNativeDriver: true, speed: 60, bounciness: 4 }),
      Animated.timing(opacity, { toValue: focused ? 1 : 0.40,   useNativeDriver: true, duration: 180 }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <View style={{ alignItems: "center" }}>
        <Ionicons
          name={icon as any}
          size={22}
          color={focused ? Colors.primary : "rgba(0,0,0,0.55)"}
        />
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: Colors.primary,
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

  const ballX      = useRef(new Animated.Value(0)).current;
  const ballScaleX = useRef(new Animated.Value(1)).current;
  const ballScaleY = useRef(new Animated.Value(1)).current;

  const activeIndex  = tabs.findIndex((t) => t.name === state.routes[state.index]?.name);
  const clampedIndex = activeIndex < 0 ? 0 : activeIndex;

  const tabWidth = barWidth > 0 ? barWidth / tabs.length : 0;
  const ballLeft = (i: number) => i * tabWidth + tabWidth / 2 - BALL_SIZE / 2;

  useEffect(() => {
    if (barWidth === 0 || activeIndex < 0) return;
    Animated.spring(ballX, {
      toValue: ballLeft(clampedIndex),
      useNativeDriver: true,
      damping: 15,
      stiffness: 180,
      mass: 0.8,
    }).start();
  }, [clampedIndex, barWidth]);

  if (activeIndex < 0) return null;

  const handleLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  const handlePress = (tabName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(ballScaleX, { toValue: 1.3,  useNativeDriver: true, speed: 120, bounciness: 0 }),
        Animated.spring(ballScaleY, { toValue: 0.75, useNativeDriver: true, speed: 120, bounciness: 0 }),
      ]),
      Animated.parallel([
        Animated.spring(ballScaleX, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
        Animated.spring(ballScaleY, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
      ]),
    ]).start();
    navigation.navigate(tabName);
  };

  const Inner = (
    <View style={styles.inner} onLayout={handleLayout}>
      {barWidth > 0 && (
        <Animated.View
          style={[
            styles.ball,
            {
              transform: [
                { translateX: ballX },
                { scaleX: ballScaleX },
                { scaleY: ballScaleY },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <BlurView
            intensity={40}
            tint="light"
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.ballHighlight} />
        </Animated.View>
      )}

      {tabs.map((tab) => {
        const route = state.routes.find((r: any) => r.name === tab.name);
        if (!route) return null;
        const focused = state.routes[state.index]?.name === tab.name;
        return (
          <Pressable
            key={tab.name}
            onPress={() => handlePress(tab.name)}
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
    <BlurView
      intensity={55}
      tint="systemUltraThinMaterialLight"
      style={containerStyle}
    >
      <View style={styles.glassEdge} />
      {Inner}
    </BlurView>
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
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 20,
  },
  androidFallback: {
    backgroundColor: "rgba(255, 240, 245, 0.92)",
  },
  glassEdge: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  ball: {
    position: "absolute",
    top: (TAB_HEIGHT - BALL_SIZE) / 2,
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    overflow: "hidden",
    backgroundColor: "rgba(254, 93, 157, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(254, 93, 157, 0.40)",
  },
  ballHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BALL_SIZE * 0.38,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    borderRadius: BALL_SIZE / 2,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: TAB_HEIGHT,
  },
});
