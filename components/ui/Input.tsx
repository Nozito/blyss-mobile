import React, { useState, useRef } from 'react';
import { View, TextInput, Text, Pressable, Animated, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightElement?: React.ReactNode;
  secure?: boolean;
  className?: string;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightElement,
  secure = false,
  value,
  className: _,
  ...props
}: InputProps) {
  const colors = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const focusAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const eyeScale = useRef(new Animated.Value(1)).current;

  const bounce = (anim: Animated.Value) =>
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.35, useNativeDriver: true, speed: 80, bounciness: 4 }),
      Animated.spring(anim, { toValue: 1,    useNativeDriver: true, speed: 60, bounciness: 0 }),
    ]).start();

  const handleFocus = (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
    setIsFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    if (leftIcon) bounce(iconScale);
    props.onFocus?.(e);
  };

  const handleBlur = (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
    setIsFocused(false);
    Animated.timing(focusAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    props.onBlur?.(e);
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? colors.destructive : colors.border, error ? colors.destructive : colors.primary],
  });

  const iconColor = isFocused ? colors.primary : colors.mutedForeground;

  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text style={{ fontSize: 13, fontWeight: '600', color: isFocused ? colors.primary : colors.foreground, letterSpacing: 0.1 }}>
          {label}
        </Text>
      )}

      <Animated.View
        style={{
          height: 44,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor,
          backgroundColor: isFocused ? colors.white : colors.cream,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          gap: 10,
        }}
      >
        {leftIcon && (
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <Ionicons name={leftIcon} size={18} color={iconColor} />
          </Animated.View>
        )}

        <TextInput
          {...props}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secure && !showPassword}
          style={{ flex: 1, fontSize: 14.5, color: colors.foreground, padding: 0, margin: 0 }}
          placeholderTextColor={colors.inputPlaceholder}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          autoCorrect={props.autoCorrect ?? false}
          accessibilityLabel={label}
        />

        {secure && (
          <Pressable
            onPress={() => {
              setShowPassword(v => !v);
              bounce(eyeScale);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            accessibilityState={{ checked: showPassword }}
          >
            <Animated.View style={{ transform: [{ scale: eyeScale }] }}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={iconColor}
              />
            </Animated.View>
          </Pressable>
        )}

        {!secure && rightElement}
      </Animated.View>

      {error && (
        <Text style={{ fontSize: 11.5, color: colors.destructive, paddingLeft: 2, fontWeight: '500' }}>
          {error}
        </Text>
      )}
      {!error && hint && (
        <Text style={{ fontSize: 11.5, color: colors.mutedForeground, paddingLeft: 2 }}>
          {hint}
        </Text>
      )}
    </View>
  );
}
