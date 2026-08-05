import React from 'react';
import { View, Text, type ViewProps } from 'react-native';
import { Image } from 'expo-image';
import { withAlpha } from '@/constants/colors';
import { useThemeColors } from '@/hooks/useThemeColors';

interface AvatarProps extends ViewProps {
  size?: number;
  className?: string;
  /** Convenience: renders AvatarImage + AvatarFallback automatically */
  uri?: string | null;
  /** Convenience: used for AvatarFallback initials */
  name?: string;
}

export function Avatar({ size = 40, className = '', uri, name, style, children, ...props }: AvatarProps) {
  return (
    <View
      {...props}
      className={['rounded-full overflow-hidden items-center justify-center', className].join(' ')}
      style={[{ width: size, height: size }, style]}
    >
      {uri !== undefined || name !== undefined ? (
        <>
          {uri ? (
            <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
          ) : (
            <AvatarFallback name={name} size={size} style={{ flex: 1, width: "100%" }} />
          )}
        </>
      ) : (
        children
      )}
    </View>
  );
}

interface AvatarFallbackProps extends ViewProps {
  name?: string;
  size?: number;
  className?: string;
}

export function AvatarFallback({ name, size = 40, className = '', style, ...props }: AvatarFallbackProps) {
  const colors = useThemeColors();
  const initials = name
    ? name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  return (
    <View
      {...props}
      className={['flex-1 w-full items-center justify-center', className].join(' ')}
      style={[{ backgroundColor: withAlpha(colors.primary, 0.15) }, style]}
    >
      <Text
        style={{ fontSize: size * 0.38, fontWeight: '600', color: colors.primary }}
      >
        {initials}
      </Text>
    </View>
  );
}
