import { Platform } from 'react-native';

const ios = (color: string, offsetY: number, opacity: number, radius: number) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: offsetY },
  shadowOpacity: opacity,
  shadowRadius: radius,
});

const android = (elevation: number) => ({ elevation });

const shadow = (color: string, offsetY: number, opacity: number, radius: number, elevation: number) =>
  Platform.OS === 'ios'
    ? ios(color, offsetY, opacity, radius)
    : android(elevation);

export const Shadows = {
  // 0 4px 20px -2px rgba(254, 93, 157, 0.1)
  soft: shadow('#FE5D9D', 4, 0.1, 20, 4),
  // 0 2px 12px -2px rgba(0, 0, 0, 0.08)
  card: shadow('#000000', 2, 0.08, 12, 3),
  // 0 8px 30px -4px rgba(0, 0, 0, 0.12)
  elevated: shadow('#000000', 8, 0.12, 30, 8),
  // 0 8px 32px -4px rgba(0, 0, 0, 0.1)
  glass: shadow('#000000', 8, 0.1, 32, 6),
} as const;

export type ShadowKey = keyof typeof Shadows;
