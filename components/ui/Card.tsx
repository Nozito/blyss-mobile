import React from 'react';
import { View, Text, type ViewProps, type TextProps } from 'react-native';
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

export function CardHeader({ children, className = '', ...props }: ViewProps & { className?: string }) {
  return (
    <View {...props} className={['flex-col gap-1.5 p-6', className].join(' ')}>
      {children}
    </View>
  );
}

export function CardTitle({ children, className = '', ...props }: TextProps & { className?: string }) {
  return (
    <Text {...props} className={['text-2xl font-semibold leading-none tracking-tight text-card-foreground', className].join(' ')}>
      {children}
    </Text>
  );
}

export function CardDescription({ children, className = '', ...props }: TextProps & { className?: string }) {
  return (
    <Text {...props} className={['text-sm text-muted-foreground', className].join(' ')}>
      {children}
    </Text>
  );
}

export function CardContent({ children, className = '', ...props }: ViewProps & { className?: string }) {
  return (
    <View {...props} className={['p-6 pt-0', className].join(' ')}>
      {children}
    </View>
  );
}

export function CardFooter({ children, className = '', ...props }: ViewProps & { className?: string }) {
  return (
    <View {...props} className={['flex-row items-center p-6 pt-0', className].join(' ')}>
      {children}
    </View>
  );
}
