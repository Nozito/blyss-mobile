import React from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";

interface AdminIconProps {
  /** SF Symbol name, used on iOS. */
  ios: SFSymbol;
  /** Ionicons name, used on Android (and web). Must be a real per-icon fallback — never a generic placeholder. */
  android: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color: string;
}

/**
 * Single entry point for admin icons across platforms.
 * SymbolView (SF Symbols) only renders on iOS — every call site must pair it
 * with a matching Ionicons fallback for Android, otherwise the icon is
 * silently missing there. Use this instead of inlining the Platform.OS
 * branch, so a missing `android` prop is a type error, not a blank icon.
 */
export function AdminIcon({ ios, android, size = 18, color }: AdminIconProps) {
  return Platform.OS === "ios"
    ? <SymbolView name={ios} size={size} tintColor={color} />
    : <Ionicons name={android} size={size} color={color} />;
}
