import React, { useState, useRef } from 'react';
import { View, TextInput, Text, Pressable, Animated, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightElement?: React.ReactNode;
  secure?: boolean;
  className?: string;
}

const P = '#FE5D9D';

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
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // border animation (non-native — drives color)
  const focusAnim = useRef(new Animated.Value(0)).current;
  // icon bounce (native — drives transform)
  const iconScale = useRef(new Animated.Value(1)).current;
  // eye icon bounce on toggle
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
    outputRange: [error ? '#EF4444' : '#E4E0DC', error ? '#EF4444' : P],
  });

  const iconColor = isFocused ? P : '#A1A1AA';

  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text style={{ fontSize: 13, fontWeight: '600', color: isFocused ? P : '#3F3F46', letterSpacing: 0.1 }}>
          {label}
        </Text>
      )}

      <Animated.View
        style={{
          height: 44,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor,
          backgroundColor: isFocused ? '#FFFFFF' : '#F8F5F2',
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
          style={{ flex: 1, fontSize: 14.5, color: '#09090B', padding: 0, margin: 0 }}
          placeholderTextColor="#C0BAB5"
          autoCapitalize={props.autoCapitalize ?? 'none'}
          autoCorrect={props.autoCorrect ?? false}
        />

        {secure && (
          <Pressable
            onPress={() => {
              setShowPassword(v => !v);
              bounce(eyeScale);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
        <Text style={{ fontSize: 11.5, color: '#EF4444', paddingLeft: 2, fontWeight: '500' }}>
          {error}
        </Text>
      )}
      {!error && hint && (
        <Text style={{ fontSize: 11.5, color: '#A1A1AA', paddingLeft: 2 }}>
          {hint}
        </Text>
      )}
    </View>
  );
}
