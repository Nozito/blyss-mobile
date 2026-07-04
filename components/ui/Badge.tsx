import React from 'react';
import { View, Text } from 'react-native';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { container: string; text: string }> = {
  default: {
    container: 'bg-primary border-transparent',
    text: 'text-white',
  },
  secondary: {
    container: 'bg-secondary border-transparent',
    text: 'text-white',
  },
  destructive: {
    container: 'bg-destructive border-transparent',
    text: 'text-white',
  },
  outline: {
    container: 'border border-border bg-transparent',
    text: 'text-foreground',
  },
  success: {
    container: 'bg-success-light border-transparent',
    text: 'text-success-text',
  },
  warning: {
    container: 'bg-warning-light border-transparent',
    text: 'text-warning-text',
  },
};

export function Badge({ children, variant = 'default', size = 'sm', className = '' }: BadgeProps) {
  const s = variantStyles[variant];
  return (
    <View
      className={[
        'rounded-full items-center justify-center border',
        size === 'sm' ? 'px-2.5 py-0.5' : 'px-3 py-1',
        s.container,
        className,
      ].join(' ')}
    >
      <Text
        className={[
          'font-semibold',
          size === 'sm' ? 'text-xs' : 'text-sm',
          s.text,
        ].join(' ')}
      >
        {children}
      </Text>
    </View>
  );
}
