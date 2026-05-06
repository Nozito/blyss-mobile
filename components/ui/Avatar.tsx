import React from "react";
import { View, Text, Image } from "react-native";
import { Colors } from "@/constants/colors";

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  className?: string;
}

export function Avatar({ uri, name, size = 40, className = "" }: AvatarProps) {
  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <View
      className={`rounded-full overflow-hidden items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: Colors.primaryLight,
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{
            fontSize: size * 0.38,
            fontWeight: "600",
            color: Colors.primary,
          }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
