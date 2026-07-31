import React from 'react';
import { Pressable, Text, ActivityIndicator, type PressableProps, type ViewStyle } from 'react-native';

type Variant = 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
type Size = 'sm' | 'default' | 'md' | 'lg' | 'icon';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, { container: string; text: string }> = {
  default: {
    container: 'bg-primary active:opacity-80',
    text: 'text-white font-semibold',
  },
  primary: {
    container: 'bg-primary active:opacity-80',
    text: 'text-white font-semibold',
  },
  secondary: {
    container: 'bg-secondary active:opacity-80',
    text: 'text-white font-semibold',
  },
  outline: {
    container: 'border border-input bg-background active:bg-accent',
    text: 'text-foreground font-semibold',
  },
  ghost: {
    container: 'bg-transparent active:bg-accent',
    text: 'text-primary font-medium',
  },
  destructive: {
    container: 'bg-destructive active:opacity-80',
    text: 'text-white font-semibold',
  },
  link: {
    container: 'bg-transparent',
    text: 'text-primary font-medium underline',
  },
};

const sizeStyles: Record<Size, { container: string; text: string }> = {
  sm:      { container: 'h-9 px-3 rounded-md',  text: 'text-sm' },
  default: { container: 'h-10 px-4 rounded-md', text: 'text-sm' },
  md:      { container: 'h-10 px-4 rounded-md', text: 'text-sm' },
  lg:      { container: 'h-11 px-8 rounded-md', text: 'text-base' },
  icon:    { container: 'h-10 w-10 rounded-md', text: 'text-sm' },
};

export function Button({
  variant = 'default',
  size = 'default',
  loading = false,
  children,
  style,
  fullWidth = false,
  disabled,
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled ?? loading;

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={style}
      className={[
        'flex-row items-center justify-center gap-2',
        v.container,
        s.container,
        fullWidth ? 'w-full' : 'self-start',
        isDisabled ? 'opacity-50' : '',
      ].join(' ')}
    >
      {loading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <Text className={`${v.text} ${s.text}`}>{children}</Text>
      )}
    </Pressable>
  );
}
