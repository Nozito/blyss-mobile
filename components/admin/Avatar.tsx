import React from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { ADMIN } from "@/constants/adminTheme";
import { resolveMediaUrl } from "@/lib/media";

function initials(name: string) {
  return name.trim().split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

// DA "Choc" : bloc carré, initiales 900. `pro` colore l'aplat en rose.
export function Avatar({ name, photo, size = 36, pro = false }: { name: string; photo?: string | null; size?: number; pro?: boolean }) {
  const uri = resolveMediaUrl(photo);
  return (
    <View style={{
      width: size, height: size, borderRadius: 3,
      backgroundColor: pro ? ADMIN.accent : ADMIN.surfaceHover,
      alignItems: "center", justifyContent: "center",
      overflow: "hidden", flexShrink: 0,
    }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{
          color: pro ? ADMIN.accentInk : ADMIN.textSub,
          fontWeight: "900", letterSpacing: -0.5,
          fontSize: Math.round(size * 0.36),
        }}>
          {initials(name) || "?"}
        </Text>
      )}
    </View>
  );
}
