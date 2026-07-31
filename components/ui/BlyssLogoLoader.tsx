import React, { useEffect } from "react";
import { View, ViewStyle } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  Extrapolation,
} from "react-native-reanimated";
import { Colors } from "@/constants/colors";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

// Tracé vectoriel du "B" Blyss (extrait de assets/logo.png via potrace)
const LOGO_PATH =
  "M7170 8999 c480 -43 845 -221 1028 -501 266 -408 143 -895 -272 -1079 -60 -26 -59 -31 27 -80 536 -312 743 -748 556 -1174 -207 -473 -990 -719 -1879 -590 -262 38 -240 38 -322 -3 l-73 -37 -140 1 c-153 0 -223 17 -279 69 -37 34 -33 57 33 186 142 273 246 600 351 1107 39 187 41 182 -82 147 -1386 -398 -1387 -1549 -2 -1929 1011 -277 2114 -6 2533 624 49 73 88 121 106 130 83 42 454 0 527 -60 l23 -18 -60 -88 c-677 -998 -2995 -1230 -4214 -423 -419 277 -604 646 -516 1029 112 492 721 858 1654 994 58 9 108 19 112 23 4 5 53 205 108 446 55 241 105 445 111 452 94 113 554 90 568 -28 2 -15 -33 -188 -78 -384 -45 -197 -82 -365 -83 -373 -6 -50 343 50 505 145 510 299 388 1005 -202 1164 -506 137 -1017 -132 -1232 -649 -70 -169 -117 -200 -304 -200 -174 0 -318 37 -330 84 -14 59 84 280 185 413 314 417 984 662 1641 602z M6843 7138 c-11 -14 -314 -1252 -313 -1279 0 -13 16 -20 63 -28 792 -134 1322 78 1344 539 18 357 -225 636 -639 735 -170 40 -434 59 -455 33z";

// Longueur de tracé surestimée pour garantir un effet "dessin" complet quelle que soit la plateforme
const DASH_LENGTH = 24000;

interface BlyssLogoLoaderProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function BlyssLogoLoader({ size = 96, color = Colors.primary, style }: BlyssLogoLoaderProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.linear }),
      -1,
      false
    );
  }, [progress]);

  const groupProps = useAnimatedProps(() => {
    const opacity = interpolate(
      progress.value,
      [0, 0.05, 0.88, 1],
      [0, 1, 1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const pathProps = useAnimatedProps(() => {
    const draw = interpolate(progress.value, [0, 0.48], [0, 1], Extrapolation.CLAMP);
    const fillOpacity = interpolate(progress.value, [0.48, 0.62], [0, 1], Extrapolation.CLAMP);
    const strokeOpacity = interpolate(progress.value, [0.48, 0.62], [1, 0], Extrapolation.CLAMP);
    return {
      strokeDashoffset: DASH_LENGTH * (1 - draw),
      fillOpacity,
      strokeOpacity,
    };
  });

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 1378 1380">
        <AnimatedG animatedProps={groupProps} transform="translate(0,1380) scale(0.1,-0.1)">
          <AnimatedPath
            d={LOGO_PATH}
            fill={color}
            fillRule="evenodd"
            stroke={color}
            strokeWidth={22}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={DASH_LENGTH}
            animatedProps={pathProps}
          />
        </AnimatedG>
      </Svg>
    </View>
  );
}
