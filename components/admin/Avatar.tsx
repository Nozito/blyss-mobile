import React from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { ADMIN } from "@/constants/adminTheme";
import { resolveMediaUrl } from "@/lib/media";

function initials(name: string) {
  return name.trim().split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function Avatar({ name, photo, size = 36 }: { name: string; photo?: string | null; size?: number }) {
  const uri = resolveMediaUrl(photo);
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: ADMIN.surfaceHover,
      alignItems: "center", justifyContent: "center",
      overflow: "hidden", flexShrink: 0,
    }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{ color: ADMIN.textSub, fontWeight: "700", fontSize: Math.round(size * 0.36) }}>
          {initials(name) || "?"}
        </Text>
      )}
    </View>
  );
}
