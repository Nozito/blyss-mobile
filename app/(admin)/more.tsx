import React, { useRef, useState } from "react";
import {
  View, Text, ScrollView, Pressable, Animated,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminApi } from "@/lib/api";
import { Colors, withAlpha } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { useScrollToTop } from "@react-navigation/native";
import RoleSelectionModal, { type AdminRole } from "@/components/ui/RoleSelectionModal";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { AdminIcon } from "@/components/admin/AdminIcon";
import { resolveMediaUrl } from "@/lib/media";
import { normalizeAdminDashboardStats } from "@/lib/adminStats";

const BG     = ADMIN.bg;
const TEXT1  = ADMIN.text;
const TEXT2  = ADMIN.textSub;
const TEXT3  = ADMIN.textMuted;
const ACCENT = ADMIN.accent;

const TOOLS = [
  { key: "coupons",    label: "Coupons",          sub: "Codes promo",       symbol: "tag.fill",             androidIcon: "pricetag-outline"        as const, color: Colors.warning,    route: "/(admin-tools)/coupons" },
  { key: "reviews",    label: "Avis",             sub: "Modération",        symbol: "text.bubble.fill",     androidIcon: "chatbubble-outline"      as const, color: Colors.destructive, route: "/(admin-tools)/reviews" },
  { key: "messages",   label: "Messages",         sub: "Conversations signalées", symbol: "flag.fill",     androidIcon: "flag-outline"            as const, color: Colors.destructive, route: "/(admin-tools)/messages" },
  { key: "analytics",  label: "Analytics",        sub: "Métriques & revenus", symbol: "chart.bar.fill",     androidIcon: "bar-chart-outline"       as const, color: Colors.pro,        route: "/(admin-tools)/analytics" },
  { key: "logs",       label: "Logs",             sub: "Événements système", symbol: "waveform",            androidIcon: "pulse-outline"           as const, color: Colors.info,       route: "/(admin-tools)/logs" },
  { key: "notifs",     label: "Notifs",           sub: "Push ciblées",      symbol: "bell.fill",            androidIcon: "notifications-outline"   as const, color: Colors.success,    route: "/(admin-tools)/notifications" },
];

const INFO_ROWS = [
  { label: "Application", value: "Blyss Admin",                         icon: "apps-outline"           as const },
  { label: "Plateforme",  value: "React Native / Expo",                  icon: "phone-portrait-outline" as const },
  { label: "Backend",     value: process.env.EXPO_PUBLIC_API_URL ?? "—", icon: "server-outline"         as const },
] as const;

// ─── ToolRow ──────────────────────────────────────────────────────────────────

function ToolRow({
  tool, isLast,
}: {
  tool: typeof TOOLS[number]; isLast: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Link href={tool.route as any} asChild>
      <Pressable
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 5 }).start()
        }
    >
      <Animated.View style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: ADMIN.border,
        transform: [{ scale }],
      }}>
        <View style={{
          width: 40, height: 40, borderRadius: 4,
          backgroundColor: withAlpha(tool.color, 0.14),
          alignItems: "center", justifyContent: "center",
        }}>
          <AdminIcon ios={tool.symbol as any} android={tool.androidIcon} size={19} color={tool.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...ADMIN.type.name, color: TEXT1 }}>{tool.label}</Text>
          <Text style={{ fontSize: 12, color: TEXT3, marginTop: 1 }}>{tool.sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={TEXT3} />
      </Animated.View>
    </Pressable>
    </Link>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminMoreScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showSwitchModal, setShowSwitchModal] = useState(false);

  const { data: dashData } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.getDashboardStats(),
    staleTime: 5 * 60_000,
  });

  const dashStats = normalizeAdminDashboardStats((dashData?.data as any)?.stats);

  const logoutScale = useRef(new Animated.Value(1)).current;

  const fullName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
  const initials = fullName.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  const photoUri = resolveMediaUrl(user?.profile_photo);

  // Le CA plateforme = abonnements pros (MRR), pas les paiements de réservations
  // (ça, c'est "encaissé dans l'app", l'argent des pros). Fallback CA résa si
  // le backend ne renvoie pas encore subMrr.
  const eur0 = (v?: number) => (v == null ? "—" : `${Math.round(v).toLocaleString("fr-FR")} €`);
  const stats = [
    { label: "Utilisateurs", value: dashStats?.totalUsers ?? "—", route: "/(admin)/users" as const },
    { label: "Abos actifs",  value: dashStats?.subsActive ?? "—", route: "/(admin-tools)/analytics" as const },
    {
      label: dashStats?.subMrr ? "MRR abos" : "Encaissé (mois)",
      value: dashStats?.subMrr ? eur0(dashStats.subMrr) : eur0(dashStats?.collectedThisMonth || dashStats?.monthRevenue),
      route: "/(admin-tools)/analytics" as const,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        automaticallyAdjustContentInsets={false}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile header ── */}
        <View style={{ paddingTop: insets.top + 16, paddingBottom: 22, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={{
            width: 60, height: 60, borderRadius: 3,
            backgroundColor: ACCENT,
            alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={{ width: 60, height: 60 }} contentFit="cover" />
            ) : (
              <Text style={{ fontSize: 22, fontWeight: "900", letterSpacing: -0.5, color: ADMIN.accentInk }}>
                {initials || "A"}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...ADMIN.type.display, fontSize: 26, color: TEXT1 }} numberOfLines={1}>
              {fullName || "Admin"}
            </Text>
            <Text style={{ ...ADMIN.type.label, color: TEXT2, marginTop: 4 }} numberOfLines={1}>
              {user?.email} · Accès total
            </Text>
          </View>
        </View>

        {/* ── Stats strip — filet, chiffres 900 ── */}
        <View style={{
          marginHorizontal: 20,
          borderWidth: 1, borderColor: ADMIN.border,
          flexDirection: "row",
        }}>
          {stats.map(({ label, value, route }, i) => (
            <React.Fragment key={label}>
              <Link href={route as any} asChild>
              <AnimatedPressable
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}
                style={{ flex: 1, paddingVertical: 16, paddingHorizontal: 12 }}
              >
                <Text style={{ ...ADMIN.type.display, fontSize: 22, color: TEXT1 }} numberOfLines={1}>
                  {value}
                </Text>
                <Text style={{ ...ADMIN.type.label, color: TEXT3, marginTop: 4 }} numberOfLines={1}>
                  {label}
                </Text>
              </AnimatedPressable>
              </Link>
              {i < stats.length - 1 && (
                <View style={{ width: 1, backgroundColor: ADMIN.border }} />
              )}
            </React.Fragment>
          ))}
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* ── Changer d'interface ── */}
          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setShowSwitchModal(true);
            }}
            style={{
              marginTop: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              padding: 16,
              borderRadius: ADMIN.cardRadius,
              backgroundColor: ADMIN.accentBg,
              borderWidth: 1,
              borderColor: ADMIN.accentBorder,
            }}
          >
            <View style={{
              width: 40, height: 40, borderRadius: 4,
              backgroundColor: withAlpha(ACCENT, 0.18),
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="swap-horizontal-outline" size={19} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...ADMIN.type.name, color: TEXT1, marginBottom: 2 }}>
                Changer d'interface
              </Text>
              <Text style={{ fontSize: 12, color: TEXT2 }}>
                Basculer vers Client, Pro ou Admin
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={ACCENT} />
          </AnimatedPressable>

          {/* ── Outils Admin ── */}
          <Text style={{
            ...ADMIN.type.label, color: TEXT3,
            marginBottom: 10,
            marginTop: 28,
          }}>
            Outils Admin
          </Text>

          <View style={{
            backgroundColor: ADMIN.surface,
            borderRadius: ADMIN.cardRadius,
            borderWidth: 1,
            borderColor: ADMIN.border,
            overflow: "hidden",
          }}>
            {TOOLS.map((tool, i) => (
              <ToolRow
                key={tool.key}
                tool={tool}
                isLast={i === TOOLS.length - 1}
              />
            ))}
          </View>

          {/* ── Bouton déconnexion ── */}
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              void logout().then(() => router.replace("/(auth)/login"));
            }}
            onPressIn={() =>
              Animated.spring(logoutScale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
            }
            onPressOut={() =>
              Animated.spring(logoutScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 5 }).start()
            }
            style={{ marginTop: 16 }}
          >
            <Animated.View style={{
              backgroundColor: ADMIN.dangerBg,
              borderRadius: ADMIN.cardRadius,
              paddingHorizontal: 16,
              paddingVertical: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              transform: [{ scale: logoutScale }],
            }}>
              <View style={{
                width: 40, height: 40, borderRadius: 4,
                backgroundColor: withAlpha(ADMIN.danger, 0.18),
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="log-out-outline" size={19} color={ADMIN.danger} />
              </View>
              <Text style={{ ...ADMIN.type.name, color: ADMIN.danger, flex: 1 }}>
                Se déconnecter
              </Text>
            </Animated.View>
          </Pressable>

          {/* ── À propos ── */}
          <Text style={{
            ...ADMIN.type.label, color: TEXT3,
            marginBottom: 10,
            marginTop: 28,
          }}>
            À propos
          </Text>

          <View style={{
            backgroundColor: ADMIN.surface,
            borderRadius: ADMIN.cardRadius,
            borderWidth: 1,
            borderColor: ADMIN.border,
            overflow: "hidden",
          }}>
            {INFO_ROWS.map(({ label, value, icon }, i) => (
              <View
                key={label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  borderBottomWidth: i < INFO_ROWS.length - 1 ? 1 : 0,
                  borderBottomColor: ADMIN.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name={icon} size={16} color={TEXT3} />
                  <Text style={{ fontSize: 14, color: TEXT2 }}>{label}</Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    maxWidth: 200,
                    fontSize: 13,
                    fontWeight: "600",
                    color: TEXT1,
                    textAlign: "right",
                  }}
                >
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <RoleSelectionModal
        visible={showSwitchModal}
        userName={fullName || "Admin"}
        userInitials={initials || "A"}
        onSelectRole={(role: AdminRole) => {
          setShowSwitchModal(false);
          const routes: Record<AdminRole, string> = {
            client: "/(client)",
            pro:    "/(pro)/dashboard",
            admin:  "/(admin)/dashboard",
          };
          router.replace(routes[role] as any);
        }}
        onClose={() => setShowSwitchModal(false)}
      />
    </View>
  );
}
