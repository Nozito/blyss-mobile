import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  Pressable,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightElement?: React.ReactNode;
  secure?: boolean;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightElement,
  secure = false,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secure;

  return (
    <View className="gap-1.5">
      {label && (
        <Text className="text-sm font-medium text-foreground">{label}</Text>
      )}

      <View
        className={[
          "flex-row items-center h-12 px-4 bg-card rounded-2xl border",
          error ? "border-destructive" : "border-border",
        ].join(" ")}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={Colors.mutedForeground}
            style={{ marginRight: 8 }}
          />
        )}

        <TextInput
          {...props}
          secureTextEntry={isPassword && !showPassword}
          className="flex-1 text-base text-foreground"
          placeholderTextColor={Colors.mutedForeground}
          autoCapitalize={props.autoCapitalize ?? "none"}
          autoCorrect={props.autoCorrect ?? false}
        />

        {isPassword && (
          <Pressable onPress={() => setShowPassword((v) => !v)} className="p-1">
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={Colors.mutedForeground}
            />
          </Pressable>
        )}

        {!isPassword && rightElement}
      </View>

      {error && <Text className="text-xs text-destructive">{error}</Text>}
      {!error && hint && (
        <Text className="text-xs text-muted-foreground">{hint}</Text>
      )}
    </View>
  );
}
