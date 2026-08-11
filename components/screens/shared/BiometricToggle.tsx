import React, { useEffect, useState } from "react";
import { View, Text, Switch, ActivityIndicator } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import { storage } from "@/lib/storage";

/** Réglage "Connexion Face ID / Touch ID" — partagé entre les paramètres
 * client et pro (voir app/(client)/(profile)/settings.tsx et
 * app/(pro)/(profile)/settings.tsx). Ne s'affiche que si l'appareil a du
 * hardware biométrique enrôlé ; désactivé par défaut, l'utilisateur doit
 * l'activer explicitement — et le faire en repassant par un scan biométrique
 * réussi, pour que l'activation reste bien liée à qui est connecté. */
export function BiometricToggle() {
  const colors = useThemeColors();
  const [available, setAvailable] = useState(false);
  const [bioType, setBioType] = useState<"face" | "fingerprint">("fingerprint");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const check = async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const isEnrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      if (hasHardware && isEnrolled) {
        setAvailable(true);
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => [] as number[]);
        const FACE_ID = LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION as number;
        setBioType(types.includes(FACE_ID) ? "face" : "fingerprint");
      }
      setEnabled(await storage.getBiometricEnabled());
      setLoading(false);
    };
    void check();
  }, []);

  const handleToggle = async (value: boolean) => {
    if (!value) {
      setEnabled(false);
      await storage.setBiometricEnabled(false);
      return;
    }
    setBusy(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: bioType === "face" ? "Confirme avec Face ID pour l'activer" : "Confirme avec Touch ID pour l'activer",
        cancelLabel: "Annuler",
        disableDeviceFallback: true,
      });
      if (result.success) {
        setEnabled(true);
        await storage.setBiometricEnabled(true);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading || !available) return null;

  const label = bioType === "face" ? "Face ID" : "Touch ID";

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Ionicons name={bioType === "face" ? "scan-outline" : "finger-print-outline"} size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>Connexion {label}</Text>
        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
          Déverrouille ton compte sans mot de passe sur cet appareil
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.onColor}
        />
      )}
    </View>
  );
}
