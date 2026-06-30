import React, { useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { reviewsApi } from "@/lib/api";
import { Colors } from "@/constants/colors";

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const s0 = useRef(new Animated.Value(1)).current;
  const s1 = useRef(new Animated.Value(1)).current;
  const s2 = useRef(new Animated.Value(1)).current;
  const s3 = useRef(new Animated.Value(1)).current;
  const s4 = useRef(new Animated.Value(1)).current;
  const scales = [s0, s1, s2, s3, s4];

  const handlePress = (i: number) => {
    onChange(i + 1);
    Animated.sequence([
      Animated.spring(scales[i], { toValue: 1.4, useNativeDriver: true, speed: 80, bounciness: 10 }),
      Animated.spring(scales[i], { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 0 }),
    ]).start();
  };

  return (
    <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Animated.View key={i} style={{ transform: [{ scale: scales[i] }] }}>
          <Pressable onPress={() => handlePress(i)}>
            <Ionicons
              name={i < value ? "star" : "star-outline"}
              size={36}
              color={i < value ? Colors.primary : Colors.disabled}
            />
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

interface ReviewModalProps {
  visible: boolean;
  proId: string | number;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReviewModal({ visible, proId, onClose, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const mutation = useMutation({
    mutationFn: () => reviewsApi.create(String(proId), { rating, comment }),
    onSuccess: () => {
      onSuccess?.();
      onClose();
      setRating(0);
      setComment("");
    },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: Colors.overlayDark }}
      >
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>Laisser un avis</Text>
          <Text style={s.subtitle}>Comment s'est passée ta séance ?</Text>
          <StarPicker value={rating} onChange={setRating} />
          <TextInput
            style={s.input}
            placeholder="Ton commentaire (optionnel)"
            placeholderTextColor={Colors.mutedForeground}
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
          />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <Pressable style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[s.submitBtn, (rating === 0 || mutation.isPending) && { opacity: 0.6 }]}
              onPress={() => mutation.mutate()}
              disabled={rating === 0 || mutation.isPending}
            >
              {mutation.isPending
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={s.submitText}>Envoyer</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet:      { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginBottom: 20 },
  title:      { fontSize: 20, fontWeight: "800", color: Colors.foreground, textAlign: "center", marginBottom: 4 },
  subtitle:   { fontSize: 13, color: Colors.mutedForeground, textAlign: "center", marginBottom: 20 },
  input:      { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, marginTop: 20, fontSize: 14, color: Colors.foreground, minHeight: 90, textAlignVertical: "top" },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 999, paddingVertical: 13, alignItems: "center" },
  cancelText: { fontSize: 15, fontWeight: "600", color: Colors.mutedForeground },
  submitBtn:  { flex: 1, backgroundColor: Colors.primary, borderRadius: 999, paddingVertical: 13, alignItems: "center" },
  submitText: { fontSize: 15, fontWeight: "700", color: Colors.white },
});
