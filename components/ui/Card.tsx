import React from 'react';
import { View, type ViewProps } from 'react-native';
import { Shadows } from '@/constants/shadows';
import { useThemeColors } from '@/hooks/useThemeColors';

interface CardProps extends ViewProps {
  children?: React.ReactNode;
  className?: string;
  elevated?: boolean;
}

export function Card({ children, className = '', elevated = true, style, ...props }: CardProps) {
  const colors = useThemeColors();
  return (
    <View
      {...props}
      className={['rounded-lg border overflow-visible', className].join(' ')}
      style={[
        { backgroundColor: colors.card, borderColor: colors.border },
        elevated ? Shadows.card : undefined,
        { overflow: 'visible' },
        style,
      ]}
    >
      {children}
    </View>
  );
}
