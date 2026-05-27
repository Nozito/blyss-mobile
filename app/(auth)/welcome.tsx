import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";
import * as Haptics from "expo-haptics";
import Svg, {
  Circle,
  Rect,
  Path,
  Ellipse,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
} from "react-native-svg";

// ─── Slide data ───────────────────────────────────────────────────────────────

const SLIDES = [
  {
    title: "Réservez en quelques secondes",
    subtitle: "Trouvez les meilleurs pros du nail art près de chez vous.",
    cta: "Continuer",
    illustrationColor: "#FE5D9D",
  },
  {
    title: "Gérez votre activité pro",
    subtitle: "Agenda, clients, paiements — tout au même endroit.",
    cta: "Continuer",
    illustrationColor: "#A855F7",
  },
  {
    title: "Beauté · Business · Sérénité",
    subtitle: "Rejoins des milliers de pros et clients qui font confiance à Blyss.",
    cta: "Commencer",
    illustrationColor: "#E8187A",
  },
];

// ─── Sparkle path helper ─────────────────────────────────────────────────────

function spark(x: number, y: number, r: number) {
  const s = r * 0.3;
  return `M${x},${y - r} L${x + s},${y - s} L${x + r},${y} L${x + s},${y + s} L${x},${y + r} L${x - s},${y + s} L${x - r},${y} L${x - s},${y - s} Z`;
}

// ─── Slide 1 — La Cliente ─────────────────────────────────────────────────────

const Slide1SVG = React.memo(function Slide1SVG({
  handFloat,
  bubbleRdvFloat,
  bubbleRatingFloat,
  sparkScale,
}: {
  handFloat: Animated.Value;
  bubbleRdvFloat: Animated.Value;
  bubbleRatingFloat: Animated.Value;
  sparkScale: Animated.Value;
}) {
  const sparkPositions = [
    { x: 60, y: 80, r: 6, delay: 0 },
    { x: 240, y: 90, r: 8, delay: 300 },
    { x: 40, y: 160, r: 5, delay: 600 },
    { x: 260, y: 140, r: 7, delay: 900 },
  ];

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Fond statique */}
      <Svg viewBox="0 0 300 280" width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id="s1FingerGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF8EC4" />
            <Stop offset="1" stopColor="#FE5D9D" />
          </SvgLinearGradient>
          <SvgLinearGradient id="s1NailGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#E8187A" />
            <Stop offset="1" stopColor="#FF8EC4" />
          </SvgLinearGradient>
        </Defs>
        {/* Orbes */}
        <Circle cx="50" cy="50" r="60" fill="#FE5D9D" fillOpacity="0.06" />
        <Circle cx="260" cy="220" r="70" fill="#E8187A" fillOpacity="0.06" />
        <Circle cx="150" cy="140" r="80" fill="#FF8EC4" fillOpacity="0.04" />
        {/* Ombre paume */}
        <Ellipse cx="150" cy="208" rx="50" ry="8" fill="#FE5D9D" fillOpacity="0.10" />
        {/* Paume */}
        <Ellipse cx="150" cy="170" rx="55" ry="40" fill="#FE5D9D" fillOpacity="0.15" />
      </Svg>

      {/* Main animée */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: handFloat }] }]}
      >
        <Svg viewBox="0 0 300 280" width="100%" height="100%">
          {/* Doigt 1 */}
          <Rect x="101" y="105" width="18" height="55" rx="9" fill="url(#s1FingerGrad)" transform="rotate(-8 110 132)" />
          <Ellipse cx="110" cy="108" rx="7" ry="5" fill="url(#s1NailGrad)" transform="rotate(-8 110 108)" />
          {/* Doigt 2 */}
          <Rect x="123" y="95" width="18" height="58" rx="9" fill="url(#s1FingerGrad)" transform="rotate(-3 132 124)" />
          <Ellipse cx="132" cy="98" rx="7" ry="5" fill="url(#s1NailGrad)" transform="rotate(-3 132 98)" />
          {/* Doigt 3 majeur */}
          <Rect x="141" y="90" width="18" height="62" rx="9" fill="url(#s1FingerGrad)" />
          <Ellipse cx="150" cy="93" rx="7" ry="5" fill="url(#s1NailGrad)" />
          {/* Doigt 4 */}
          <Rect x="159" y="96" width="18" height="58" rx="9" fill="url(#s1FingerGrad)" transform="rotate(3 168 125)" />
          <Ellipse cx="168" cy="99" rx="7" ry="5" fill="url(#s1NailGrad)" transform="rotate(3 168 99)" />
          {/* Doigt 5 auriculaire */}
          <Rect x="177" y="108" width="18" height="50" rx="9" fill="url(#s1FingerGrad)" transform="rotate(8 186 133)" />
          <Ellipse cx="186" cy="111" rx="7" ry="5" fill="url(#s1NailGrad)" transform="rotate(8 186 111)" />
        </Svg>
      </Animated.View>

      {/* Bulle RDV */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: bubbleRdvFloat }] }]}
      >
        <Svg viewBox="0 0 300 280" width="100%" height="100%">
          <Rect x="22" y="32" width="110" height="44" rx="14" fill="#E8187A" fillOpacity="0.08" />
          <Rect x="20" y="30" width="110" height="44" rx="14" fill="white" />
          <Circle cx="42" cy="52" r="10" fill="#E8187A" />
          <Path d="M37,52 L40,56 L47,48" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Rect x="58" y="46" width="54" height="6" rx="3" fill="#1A0010" fillOpacity="0.12" />
          <Rect x="58" y="56" width="38" height="5" rx="3" fill="#1A0010" fillOpacity="0.08" />
        </Svg>
      </Animated.View>

      {/* Bulle rating */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: bubbleRatingFloat }] }]}
      >
        <Svg viewBox="0 0 300 280" width="100%" height="100%">
          <Rect x="175" y="20" width="100" height="36" rx="12" fill="white" fillOpacity="0.9" />
          {/* 5 étoiles simplifiées */}
          <Path d="M184,38 l2,-5 l2,5 l5,0 l-4,3 l2,5 l-5,-3 l-5,3 l2,-5 l-4,-3 Z" fill="#F97316" />
          <Path d="M201,38 l2,-5 l2,5 l5,0 l-4,3 l2,5 l-5,-3 l-5,3 l2,-5 l-4,-3 Z" fill="#F97316" />
          <Path d="M218,38 l2,-5 l2,5 l5,0 l-4,3 l2,5 l-5,-3 l-5,3 l2,-5 l-4,-3 Z" fill="#F97316" />
          <Path d="M235,38 l2,-5 l2,5 l5,0 l-4,3 l2,5 l-5,-3 l-5,3 l2,-5 l-4,-3 Z" fill="#F97316" />
          <Path d="M252,38 l2,-5 l2,5 l5,0 l-4,3 l2,5 l-5,-3 l-5,3 l2,-5 l-4,-3 Z" fill="#F97316" />
        </Svg>
      </Animated.View>

      {/* Sparkles */}
      {sparkPositions.map((sp, i) => (
        <Animated.View
          key={i}
          style={[StyleSheet.absoluteFill, { transform: [{ scale: sparkScale }] }]}
        >
          <Svg viewBox="0 0 300 280" width="100%" height="100%">
            <Path d={spark(sp.x, sp.y, sp.r)} fill="#E8187A" fillOpacity={i % 2 === 0 ? "0.7" : "0.5"} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
});

// ─── Slide 2 — La Pro ─────────────────────────────────────────────────────────

const Slide2SVG = React.memo(function Slide2SVG({
  agendaFloat,
  cardFloat,
  graphFloat,
  sparkScale,
}: {
  agendaFloat: Animated.Value;
  cardFloat: Animated.Value;
  graphFloat: Animated.Value;
  sparkScale: Animated.Value;
}) {
  const bar0H = useRef(new Animated.Value(0)).current;
  const bar1H = useRef(new Animated.Value(0)).current;
  const bar2H = useRef(new Animated.Value(0)).current;
  const bar3H = useRef(new Animated.Value(0)).current;
  const barAnims = [bar0H, bar1H, bar2H, bar3H];
  const barMaxH  = [30, 20, 40, 35];
  const barOpac  = [0.4, 0.55, 0.9, 0.7];

  useEffect(() => {
    barAnims.forEach((b, i) => {
      setTimeout(() => {
        Animated.spring(b, {
          toValue: barMaxH[i],
          damping: 14,
          stiffness: 120,
          useNativeDriver: false,
        }).start();
      }, 300 + i * 100);
    });
  }, []);

  const sparkPositions = [
    { x: 55, y: 75, r: 6 },
    { x: 245, y: 85, r: 8 },
    { x: 35, y: 165, r: 5 },
    { x: 255, y: 145, r: 7 },
  ];

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Fond */}
      <Svg viewBox="0 0 300 280" width="100%" height="100%">
        <Circle cx="60" cy="60" r="65" fill="#A855F7" fillOpacity="0.05" />
        <Circle cx="250" cy="210" r="75" fill="#A855F7" fillOpacity="0.05" />
      </Svg>

      {/* Agenda */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: agendaFloat }] }]}
      >
        <Svg viewBox="0 0 300 280" width="100%" height="100%">
          {/* Shadow */}
          <Rect x="72" y="63" width="160" height="160" rx="20" fill="#A855F7" fillOpacity="0.08" />
          {/* Body */}
          <Rect x="70" y="60" width="160" height="160" rx="20" fill="white" fillOpacity="0.92" />
          {/* Header */}
          <Rect x="70" y="60" width="160" height="36" rx="20" fill="#A855F7" />
          <Rect x="70" y="80" width="160" height="16" fill="#A855F7" />
          <Rect x="95" y="72" width="60" height="8" rx="4" fill="white" fillOpacity="0.8" />
          {/* Grille 3×4 */}
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2].map((col) => {
              const cx = 85 + col * 45;
              const cy = 110 + row * 30;
              const isToday    = row === 1 && col === 1;
              const isOccupied = (row === 0 && col === 0) || (row === 2 && col === 2) || (row === 3 && col === 1);
              return (
                <Rect
                  key={`${row}-${col}`}
                  x={cx} y={cy}
                  width="36" height="18" rx="6"
                  fill={isToday ? "#E8187A" : isOccupied ? "#A855F7" : "#F3E8FF"}
                  fillOpacity={isOccupied && !isToday ? "0.7" : "1"}
                />
              );
            })
          )}
        </Svg>
      </Animated.View>

      {/* Card client */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: cardFloat }] }]}
      >
        <Svg viewBox="0 0 300 280" width="100%" height="100%">
          <Rect x="8" y="90" width="80" height="52" rx="14" fill="white" fillOpacity="0.95" />
          <Circle cx="26" cy="110" r="12" fill="#A855F7" fillOpacity="0.3" />
          <Rect x="42" y="104" width="36" height="6" rx="3" fill="#1A0010" fillOpacity="0.15" />
          <Rect x="42" y="114" width="26" height="5" rx="3" fill="#1A0010" fillOpacity="0.10" />
          <Circle cx="78" cy="92" r="6" fill="#10B981" />
          <Path d="M75,92 L77,95 L81,89" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Animated.View>

      {/* Graphe container */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: graphFloat }] }]}
      >
        <Svg viewBox="0 0 300 280" width="100%" height="100%">
          <Rect x="212" y="100" width="78" height="70" rx="14" fill="white" fillOpacity="0.92" />
          <Path
            d="M220,158 Q231,148 242,144 Q253,140 264,130 Q273,123 280,118"
            stroke="#A855F7" strokeWidth="2" fill="none" strokeLinecap="round"
          />
          <Path d="M277,108 L283,103 L289,108" stroke="#10B981" strokeWidth="2" strokeLinecap="round" fill="none" />
          <Path d="M283,103 L283,116" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        </Svg>

        {/* Barres animées (useNativeDriver: false) */}
        {barAnims.map((b, i) => (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              bottom: "28%" as any,
              left: `${((220 + i * 14) / 300) * 100}%` as any,
              width: 10,
              height: b,
              borderRadius: 5,
              backgroundColor: "#A855F7",
              opacity: barOpac[i],
            }}
          />
        ))}
      </Animated.View>

      {/* Sparkles */}
      {sparkPositions.map((sp, i) => (
        <Animated.View
          key={i}
          style={[StyleSheet.absoluteFill, { transform: [{ scale: sparkScale }] }]}
        >
          <Svg viewBox="0 0 300 280" width="100%" height="100%">
            <Path d={spark(sp.x, sp.y, sp.r)} fill="#A855F7" fillOpacity={i % 2 === 0 ? "0.7" : "0.5"} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
});

// ─── Slide 3 — L'union ───────────────────────────────────────────────────────

const Slide3SVG = React.memo(function Slide3SVG({
  blobScale,
  logoFloat,
  orbitRoseRot,
  orbitPurpleRot,
  sparkScale,
}: {
  blobScale: Animated.Value;
  logoFloat: Animated.Value;
  orbitRoseRot: Animated.Value;
  orbitPurpleRot: Animated.Value;
  sparkScale: Animated.Value;
}) {
  const sparkPositions = [
    { x: 60, y: 80, r: 6 },
    { x: 240, y: 90, r: 8 },
    { x: 40, y: 165, r: 5 },
    { x: 258, y: 145, r: 7 },
  ];

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Fond statique */}
      <Svg viewBox="0 0 300 280" width="100%" height="100%">
        <Defs>
          <RadialGradient id="s3BlobGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FE5D9D" stopOpacity="0.15" />
            <Stop offset="1" stopColor="#E8187A" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="70" cy="60" r="60" fill="#FE5D9D" fillOpacity="0.05" />
        <Circle cx="240" cy="220" r="70" fill="#A855F7" fillOpacity="0.05" />
        {/* Particules dorées */}
        <Circle cx="80"  cy="95"  r="4" fill="#F97316" fillOpacity="0.7" />
        <Circle cx="220" cy="80"  r="3" fill="#F97316" fillOpacity="0.8" />
        <Circle cx="60"  cy="180" r="5" fill="#F97316" fillOpacity="0.6" />
        <Circle cx="245" cy="170" r="4" fill="#F97316" fillOpacity="0.75" />
        <Circle cx="100" cy="240" r="3" fill="#F97316" fillOpacity="0.65" />
        <Circle cx="205" cy="245" r="4" fill="#F97316" fillOpacity="0.7" />
        <Circle cx="155" cy="55"  r="3" fill="#F97316" fillOpacity="0.8" />
        <Circle cx="180" cy="240" r="5" fill="none" stroke="#F97316" strokeWidth="1" />
      </Svg>

      {/* Blob respirant */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ scale: blobScale }] }]}
      >
        <Svg viewBox="0 0 300 280" width="100%" height="100%">
          <Path
            d="M150,70 C185,65 215,85 225,115 C240,150 225,185 200,200 C175,218 130,218 105,200 C80,185 65,150 75,115 C85,85 115,75 150,70 Z"
            fill="url(#s3BlobGrad)"
          />
          <Path
            d="M150,78 C182,74 208,92 218,120 C230,152 216,182 194,196 C172,212 128,212 106,196 C84,182 72,152 80,120 C90,92 118,82 150,78 Z"
            fill="#A855F7" fillOpacity="0.08"
          />
          {/* Couronne */}
          <Path
            d="M132,72 L138,62 L144,72 L150,58 L156,72 L162,62 L168,72 L165,78 L135,78 Z"
            fill="#F97316" fillOpacity="0.5"
          />
        </Svg>
      </Animated.View>

      {/* Orbite rose — rotation */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { translateX: 150 },
              { translateY: 140 },
              {
                rotate: orbitRoseRot.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "360deg"],
                }),
              },
              { translateX: -150 },
              { translateY: -140 },
            ],
          },
        ]}
      >
        <Svg viewBox="0 0 300 280" width="100%" height="100%">
          <Path
            d="M150,45 A95,95 0 0,0 150,235"
            stroke="#FE5D9D" strokeWidth="1.5" strokeDasharray="4 6"
            fill="none" strokeOpacity="0.4"
          />
          <Circle cx="67" cy="188" r="18" fill="#FE5D9D" fillOpacity="0.15" />
          <Path
            d="M67,183 C67,181 65,179 63,181 C61,183 63,186 67,189 C71,186 73,183 71,181 C69,179 67,181 67,183 Z"
            fill="#FE5D9D" fillOpacity="0.8"
          />
        </Svg>
      </Animated.View>

      {/* Orbite violette — rotation inverse */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { translateX: 150 },
              { translateY: 140 },
              {
                rotate: orbitPurpleRot.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "-360deg"],
                }),
              },
              { translateX: -150 },
              { translateY: -140 },
            ],
          },
        ]}
      >
        <Svg viewBox="0 0 300 280" width="100%" height="100%">
          <Path
            d="M150,45 A95,95 0 0,1 150,235"
            stroke="#A855F7" strokeWidth="1.5" strokeDasharray="4 6"
            fill="none" strokeOpacity="0.4"
          />
          <Circle cx="233" cy="188" r="18" fill="#A855F7" fillOpacity="0.15" />
          <Rect x="226" y="185" width="14" height="10" rx="2" fill="#A855F7" fillOpacity="0.8" />
          <Path
            d="M230,185 L230,183 Q230,181 233,181 Q236,181 236,183 L236,185"
            stroke="#A855F7" strokeWidth="1.5" fill="none" strokeOpacity="0.8"
          />
        </Svg>
      </Animated.View>

      {/* Logo flottant */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: logoFloat }] }]}
        pointerEvents="none"
      >
        <Svg viewBox="0 0 300 280" width="100%" height="100%">
          <Rect x="113" y="103" width="78" height="78" rx="22" fill="#E8187A" fillOpacity="0.10" />
          <Rect x="111" y="101" width="78" height="78" rx="22" fill="white" fillOpacity="0.95" />
        </Svg>
        <View style={styles.logoOverlay} pointerEvents="none">
          <Image
            source={require("@/assets/logo.png")}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* Sparkles */}
      {sparkPositions.map((sp, i) => (
        <Animated.View
          key={i}
          style={[StyleSheet.absoluteFill, { transform: [{ scale: sparkScale }] }]}
        >
          <Svg viewBox="0 0 300 280" width="100%" height="100%">
            <Path d={spark(sp.x, sp.y, sp.r)} fill="#E8187A" fillOpacity={i % 2 === 0 ? "0.7" : "0.5"} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
});

// ─── SlideIllustration dispatcher ────────────────────────────────────────────

function SlideIllustration({
  slideIndex,
  floatAnim,
  orbAnim0,
  orbAnim1,
  orbAnim2,
  blobScale,
  orbitRose,
  orbitPurple,
  sparkScale,
}: {
  slideIndex: number;
  floatAnim: Animated.Value;
  orbAnim0: Animated.Value;
  orbAnim1: Animated.Value;
  orbAnim2: Animated.Value;
  blobScale: Animated.Value;
  orbitRose: Animated.Value;
  orbitPurple: Animated.Value;
  sparkScale: Animated.Value;
}) {
  if (slideIndex === 0) {
    return (
      <Slide1SVG
        handFloat={floatAnim}
        bubbleRdvFloat={orbAnim0}
        bubbleRatingFloat={orbAnim1}
        sparkScale={sparkScale}
      />
    );
  }
  if (slideIndex === 1) {
    return (
      <Slide2SVG
        agendaFloat={floatAnim}
        cardFloat={orbAnim0}
        graphFloat={orbAnim1}
        sparkScale={sparkScale}
      />
    );
  }
  return (
    <Slide3SVG
      blobScale={blobScale}
      logoFloat={floatAnim}
      orbitRoseRot={orbitRose}
      orbitPurpleRot={orbitPurple}
      sparkScale={sparkScale}
    />
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Entrée globale
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerY       = useRef(new Animated.Value(-16)).current;
  const illustScale   = useRef(new Animated.Value(0.9)).current;
  const illustOpacity = useRef(new Animated.Value(0)).current;
  const cardY         = useRef(new Animated.Value(60)).current;

  // Animations illustrations communes
  const floatAnim  = useRef(new Animated.Value(0)).current;
  const orbAnim0   = useRef(new Animated.Value(0)).current;
  const orbAnim1   = useRef(new Animated.Value(0)).current;
  const sparkScale = useRef(new Animated.Value(1)).current;

  // Slide 3 spécifiques
  const blobScale   = useRef(new Animated.Value(1)).current;
  const orbitRose   = useRef(new Animated.Value(0)).current;
  const orbitPurple = useRef(new Animated.Value(0)).current;

  // Dots (useNativeDriver: false)
  const dotWidth0 = useRef(new Animated.Value(24)).current;
  const dotWidth1 = useRef(new Animated.Value(8)).current;
  const dotWidth2 = useRef(new Animated.Value(8)).current;
  const dotWidths = [dotWidth0, dotWidth1, dotWidth2];

  // Transition slides
  const textOpacity        = useRef(new Animated.Value(1)).current;
  const textY              = useRef(new Animated.Value(0)).current;
  const illustTransOpacity = useRef(new Animated.Value(1)).current;
  const illustTransX       = useRef(new Animated.Value(0)).current;

  const ctaScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(headerY,       { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(100),
        Animated.parallel([
          Animated.spring(illustScale,   { toValue: 1, damping: 16, stiffness: 120, useNativeDriver: true }),
          Animated.timing(illustOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(cardY, { toValue: 0, damping: 18, stiffness: 120, useNativeDriver: true }),
      ]),
    ]).start();

    const t = setTimeout(() => {
      // Float principal
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: -6, duration: 2000, useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 0,  duration: 2000, useNativeDriver: true }),
        ])
      ).start();

      // orbAnim0 — décalé 200ms
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(orbAnim0, { toValue: -4, duration: 2400, useNativeDriver: true }),
            Animated.timing(orbAnim0, { toValue: 0,  duration: 2400, useNativeDriver: true }),
          ])
        ).start();
      }, 200);

      // orbAnim1 — décalé 500ms
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(orbAnim1, { toValue: -5, duration: 2200, useNativeDriver: true }),
            Animated.timing(orbAnim1, { toValue: 0,  duration: 2200, useNativeDriver: true }),
          ])
        ).start();
      }, 500);

      // Sparkles pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkScale, { toValue: 1.2, duration: 900, useNativeDriver: true }),
          Animated.timing(sparkScale, { toValue: 0.8, duration: 900, useNativeDriver: true }),
        ])
      ).start();

      // Blob respiration slide 3
      Animated.loop(
        Animated.sequence([
          Animated.timing(blobScale, { toValue: 1.03, duration: 3000, useNativeDriver: true }),
          Animated.timing(blobScale, { toValue: 0.97, duration: 3000, useNativeDriver: true }),
        ])
      ).start();

      // Orbites slide 3
      Animated.loop(
        Animated.timing(orbitRose, { toValue: 1, duration: 12000, useNativeDriver: true })
      ).start();
      Animated.loop(
        Animated.timing(orbitPurple, { toValue: 1, duration: 15000, useNativeDriver: true })
      ).start();
    }, 600);

    return () => clearTimeout(t);
  }, []);

  const goToSlide = (next: number) => {
    const prev = currentSlide;
    Animated.spring(dotWidths[prev], { toValue: 8,  useNativeDriver: false }).start();
    Animated.spring(dotWidths[next], { toValue: 24, useNativeDriver: false }).start();

    Animated.parallel([
      Animated.timing(textOpacity,        { toValue: 0,   duration: 180, useNativeDriver: true }),
      Animated.timing(textY,              { toValue: -12, duration: 180, useNativeDriver: true }),
      Animated.timing(illustTransOpacity, { toValue: 0,   duration: 150, useNativeDriver: true }),
      Animated.timing(illustTransX,       { toValue: -30, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setCurrentSlide(next);
      textY.setValue(12);
      illustTransX.setValue(30);
      Animated.parallel([
        Animated.timing(textOpacity,        { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(textY,              { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(illustTransOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(illustTransX,       { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const springPress = (val: Animated.Value, to: number) =>
    Animated.spring(val, { toValue: to, damping: 15, stiffness: 300, useNativeDriver: true }).start();

  const slide  = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;

  return (
    <View style={styles.root}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { paddingTop: insets.top + 8 },
          { opacity: headerOpacity, transform: [{ translateY: headerY }] },
        ]}
      >
        <Text style={styles.headerBrand}>Blyss</Text>
        <Pressable onPress={() => router.push("/(auth)/login")} style={styles.loginPill}>
          <Text style={styles.loginPillText}>Connexion</Text>
        </Pressable>
      </Animated.View>

      {/* Zone illustration */}
      <Animated.View
        style={[
          styles.illustrationZone,
          { opacity: illustOpacity, transform: [{ scale: illustScale }] },
        ]}
      >
        <Animated.View
          style={[
            styles.illustrationContent,
            { opacity: illustTransOpacity, transform: [{ translateX: illustTransX }] },
          ]}
        >
          <LinearGradient
            colors={[slide.illustrationColor + "18", "#FFF0F5"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <SlideIllustration
            slideIndex={currentSlide}
            floatAnim={floatAnim}
            orbAnim0={orbAnim0}
            orbAnim1={orbAnim1}
            orbAnim2={orbAnim1}
            blobScale={blobScale}
            orbitRose={orbitRose}
            orbitPurple={orbitPurple}
            sparkScale={sparkScale}
          />
        </Animated.View>
      </Animated.View>

      {/* Carte bas */}
      <Animated.View
        style={[
          styles.bottomCard,
          { paddingBottom: Math.max(insets.bottom + 16, 28) },
          { transform: [{ translateY: cardY }] },
        ]}
      >
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: dotWidths[i],
                  backgroundColor:
                    i === currentSlide ? "#E8187A" : "rgba(232,24,122,0.20)",
                },
              ]}
            />
          ))}
        </View>

        {/* Texte */}
        <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textY }] }}>
          <Text style={styles.slideTitle}>{slide.title}</Text>
          <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
        </Animated.View>

        {/* CTA */}
        <Pressable
          onPressIn={() => {
            springPress(ctaScale, 0.96);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          onPressOut={() => springPress(ctaScale, 1)}
          onPress={() => {
            if (isLast) router.push("/(auth)/register");
            else goToSlide(currentSlide + 1);
          }}
        >
          <Animated.View style={[styles.ctaWrap, { transform: [{ scale: ctaScale }] }]}>
            <LinearGradient
              colors={["#E8187A", "#FE5D9D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>{slide.cta}</Text>
              {isLast &&
                (Platform.OS === "ios" ? (
                  <SymbolView name={"checkmark" as SFSymbol} size={18} tintColor="#fff" />
                ) : (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                ))}
            </LinearGradient>
          </Animated.View>
        </Pressable>

        {/* Légal slide 3 */}
        {currentSlide === 2 && (
          <Text style={styles.legal}>
            {"En continuant, tu acceptes nos "}
            <Text style={styles.legalLink}>CGU</Text>
            {" et la "}
            <Text style={styles.legalLink}>Politique de confidentialité</Text>
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFBFC" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  headerBrand: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1A0010",
    letterSpacing: -0.5,
  },
  loginPill: {
    backgroundColor: "rgba(232,24,122,0.10)",
    borderWidth: 1,
    borderColor: "rgba(232,24,122,0.20)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
  },
  loginPillText: { color: "#E8187A", fontWeight: "700", fontSize: 14 },

  illustrationZone: { flex: 1, overflow: "hidden" },
  illustrationContent: { flex: 1, alignItems: "center", justifyContent: "center" },

  logoOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: { width: 52, height: 52 },

  bottomCard: {
    backgroundColor: "#FFFBFC",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 28,
    paddingTop: 32,
    shadowColor: "#E8187A",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  },

  dotsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 28,
    alignSelf: "flex-start",
  },
  dot: { height: 8, borderRadius: 4 },

  slideTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1A0010",
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  slideSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(0,0,0,0.45)",
    lineHeight: 22,
    marginBottom: 32,
  },

  ctaWrap: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#E8187A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 18,
    elevation: 8,
  },
  ctaGradient: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  legal: {
    fontSize: 11,
    color: "rgba(0,0,0,0.35)",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 14,
  },
  legalLink: { color: "#E8187A", fontWeight: "600" },
});
