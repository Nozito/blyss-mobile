import React from 'react';
import { View, Text } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

function getVariantStyles(colors: ReturnType<typeof useThemeColors>): Record<BadgeVariant, { bg: string; border: string; text: string }> {
  return {
    default: { bg: colors.primary, border: 'transparent', text: '#FFFFFF' },
    secondary: { bg: colors.secondary, border: 'transparent', text: '#FFFFFF' },
    destructive: { bg: colors.destructive, border: 'transparent', text: '#FFFFFF' },
    outline: { bg: 'transparent', border: colors.border, text: colors.foreground },
    success: { bg: colors.successLight, border: 'transparent', text: colors.successText },
    warning: { bg: colors.warningLight, border: 'transparent', text: colors.warningText },
  };
}

export function Badge({ children, variant = 'default', size = 'sm', className = '' }: BadgeProps) {
  const colors = useThemeColors();
  const s = getVariantStyles(colors)[variant];
  return (
    <View
      className={[
        'rounded-full items-center justify-center border',
        size === 'sm' ? 'px-2.5 py-0.5' : 'px-3 py-1',
        className,
      ].join(' ')}
      style={{ backgroundColor: s.bg, borderColor: s.border }}
    >
      <Text
        className={[
          'font-semibold',
          size === 'sm' ? 'text-xs' : 'text-sm',
        ].join(' ')}
        style={{ color: s.text }}
      >
        {children}
      </Text>
    </View>
  );
}
