import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, type TextInputProps } from 'react-native';
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

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightElement,
  secure = false,
  className = '',
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View className="gap-1.5">
      {label && (
        <Text className="text-sm font-medium text-foreground">{label}</Text>
      )}

      <View
        className={[
          'flex-row items-center h-10 px-3 bg-background rounded-md border',
          error ? 'border-destructive' : 'border-input',
          className,
        ].join(' ')}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={16}
            color="#6D6D78"
            style={{ marginRight: 6 }}
          />
        )}

        <TextInput
          {...props}
          secureTextEntry={secure && !showPassword}
          className="flex-1 text-base text-foreground"
          placeholderTextColor="#6D6D78"
          autoCapitalize={props.autoCapitalize ?? 'none'}
          autoCorrect={props.autoCorrect ?? false}
        />

        {secure && (
          <Pressable onPress={() => setShowPassword((v) => !v)} className="p-1">
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={16}
              color="#6D6D78"
            />
          </Pressable>
        )}

        {!secure && rightElement}
      </View>

      {error && (
        <Text className="text-xs text-destructive">{error}</Text>
      )}
      {!error && hint && (
        <Text className="text-xs text-muted-foreground">{hint}</Text>
      )}
    </View>
  );
}
