import React from 'react';
import { View, Text, Image, type ImageProps, type ViewProps } from 'react-native';

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
            <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
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

interface AvatarImageProps extends Omit<ImageProps, 'source'> {
  uri?: string | null;
  size?: number;
}

export function AvatarImage({ uri, size = 40, ...props }: AvatarImageProps) {
  if (!uri) return null;
  return (
    <Image
      {...props}
      source={{ uri }}
      style={{ width: size, height: size }}
      resizeMode="cover"
    />
  );
}

interface AvatarFallbackProps extends ViewProps {
  name?: string;
  size?: number;
  className?: string;
}

export function AvatarFallback({ name, size = 40, className = '', style, ...props }: AvatarFallbackProps) {
  const initials = name
    ? name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  return (
    <View
      {...props}
      className={['flex-1 w-full items-center justify-center bg-accent', className].join(' ')}
      style={style}
    >
      <Text
        style={{ fontSize: size * 0.38, fontWeight: '600', color: '#FE5D9D' }}
      >
        {initials}
      </Text>
    </View>
  );
}
