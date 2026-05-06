import React from "react";
import { ScrollView, View, type ViewProps, type ScrollViewProps, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

interface SafeScreenProps extends ViewProps {
  children: React.ReactNode;
  scroll?: boolean;
  scrollProps?: ScrollViewProps;
  onRefresh?: () => void;
  refreshing?: boolean;
  padding?: boolean;
}

export function SafeScreen({
  children,
  scroll = false,
  scrollProps,
  onRefresh,
  refreshing = false,
  padding = true,
  ...props
}: SafeScreenProps) {
  const insets = useSafeAreaInsets();

  const content = (
    <View
      {...props}
      className={`flex-1 bg-background ${padding ? "px-4" : ""}`}
      style={[{ paddingTop: insets.top }, props.style]}
    >
      {children}
    </View>
  );

  if (scroll) {
    return (
      <ScrollView
        {...scrollProps}
        className="flex-1 bg-background"
        contentContainerStyle={[
          { paddingTop: insets.top, paddingBottom: insets.bottom + 80 },
          padding && { paddingHorizontal: 16 },
          scrollProps?.contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    );
  }

  return content;
}
