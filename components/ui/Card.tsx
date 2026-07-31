import React from 'react';
import { View, type ViewProps } from 'react-native';
import { Shadows } from '@/constants/shadows';

interface CardProps extends ViewProps {
  children?: React.ReactNode;
  className?: string;
  elevated?: boolean;
}

export function Card({ children, className = '', elevated = true, style, ...props }: CardProps) {
  return (
    <View
      {...props}
      className={['bg-card rounded-lg border border-border overflow-visible', className].join(' ')}
      style={[elevated ? Shadows.card : undefined, { overflow: 'visible' }, style]}
    >
      {children}
    </View>
  );
}
