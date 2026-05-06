import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { clientApi, nailTechApi } from "@/lib/api";
import { Colors } from "@/constants/colors";

const MONTH_NAMES = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const DAY_NAMES = ["D", "L", "M", "M", "J", "V", "S"];

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ??
  "http://localhost:3001";

interface Booking {
  id: number;
  pro_id: number;
  start_datetime: string;
  end_datetime: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  price: number | string;
  paid_online: boolean;
  prestation_name: string;
  duration_minutes: number;
  pro_first_name: string;
  pro_last_name: string;
  activity_name: string | null;
  profile_photo: string | null;
  city: string | null;
  cancellation_notice_hours: number;
}

interface WaitingEntry {
  id: number;
  pro_id: number;
  pro_name: string;
  pro_photo?: string | null;
  prestation_name?: string | null;
  preferred_date?: string | null;
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({
  selectedDate,
  onSelect,
  availableDates,
  onMonthChange,
}: {
  selectedDate: Date | null;
  onSelect: (d: Date) => void;
  availableDates: Set<string>;
  onMonthChange: (year: number, month: number) => void;
}) {
  const [current, setCurrent] = useState(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = useMemo(() => {
    const year = current.getFullYear();
    const month = current.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    return arr;
  }, [current]);

  const prevMonth = () => {
    const d = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    setCurrent(d);
    onMonthChange(d.getFullYear(), d.getMonth() + 1);
  };
  const nextMonth = () => {
    const d = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    setCurrent(d);
    onMonthChange(d.getFullYear(), d.getMonth() + 1);
  };

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <Pressable
          onPress={prevMonth}
          style={{
            width: 32,
            height: 32,
            borderRadius: 12,
            backgroundColor: Colors.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={16} color={Colors.foreground} />
        </Pressable>
        <Text
          style={{ fontSize: 14, fontWeight: "700", color: Colors.foreground }}
        >
          {MONTH_NAMES[current.getMonth()]} {current.getFullYear()}
        </Text>
        <Pressable
          onPress={nextMonth}
          style={{
            width: 32,
            height: 32,
            borderRadius: 12,
            backgroundColor: Colors.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="chevron-forward"
            size={16}
            color={Colors.foreground}
          />
        </Pressable>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: "row", marginBottom: 4 }}>
        {DAY_NAMES.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "600",
                color: Colors.mutedForeground,
              }}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Days grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {days.map((day, i) => {
          if (!day) {
            return <View key={i} style={{ width: `${100 / 7}%` }} />;
          }
          const isPast = day < today;
          const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
          const isAvailable = availableDates.has(key);
          const isSelected =
            selectedDate &&
            day.toDateString() === selectedDate.toDateString();

          return (
            <View
              key={i}
              style={{
                width: `${100 / 7}%`,
                aspectRatio: 1,
                padding: 2,
              }}
            >
              <Pressable
                disabled={isPast || !isAvailable}
                onPress={() => onSelect(day)}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSelected
                    ? Colors.primary
                    : "transparent",
                  opacity: isPast || !isAvailable ? 0.35 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "500",
                    color: isSelected ? "#fff" : Colors.foreground,
                  }}
                >
                  {day.getDate()}
                </Text>
                {isAvailable && !isPast && !isSelected && (
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: Colors.primary,
                      marginTop: 1,
                    }}
                  />
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Reschedule Modal ──────────────────────────────────────────────────────────

function RescheduleModal({
  booking,
  onClose,
  onConfirm,
}: {
  booking: Booking;
  onClose: () => void;
  onConfirm: (startDt: string, endDt: string, slotId: number | null) => Promise<void>;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    id: number;
    time: string;
  } | null>(null);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<Array<{ id: number; time: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDates = useCallback(
    async (year: number, month: number) => {
      try {
        const ym = `${year}-${String(month).padStart(2, "0")}`;
        const res = await fetch(
          `${API_BASE_URL}/api/slots/available-dates/${booking.pro_id}/${ym}`
        );
        const data = (await res.json()) as {
          success: boolean;
          data?: string[];
        };
        if (data.success && Array.isArray(data.data)) {
          setAvailableDates(new Set(data.data.map(String)));
        }
      } catch {
        /* silent */
      }
    },
    [booking.pro_id]
  );

  React.useEffect(() => {
    const now = new Date();
    void fetchDates(now.getFullYear(), now.getMonth() + 1);
  }, [fetchDates]);

  const handleSelectDate = async (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setLoadingSlots(true);
    try {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const res = await fetch(
        `${API_BASE_URL}/api/slots/available/${booking.pro_id}/${dateStr}`
      );
      const data = (await res.json()) as {
        success: boolean;
        data?: Array<{ id: number; time: string }>;
      };
      if (data.success && Array.isArray(data.data)) {
        setSlots(data.data.map((s) => ({ id: s.id, time: s.time })));
      } else {
        setSlots([]);
      }
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSlot) return;
    setIsSubmitting(true);
    try {
      const [h, m] = selectedSlot.time.split(":").map(Number);
      const start = new Date(selectedDate);
      start.setHours(h, m, 0, 0);
      const end = new Date(
        start.getTime() + booking.duration_minutes * 60_000
      );
      await onConfirm(
        start.toISOString().slice(0, 19).replace("T", " "),
        end.toISOString().slice(0, 19).replace("T", " "),
        selectedSlot.id
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={{
            backgroundColor: Colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 32,
            maxHeight: "85%",
            borderTopWidth: 2,
            borderTopColor: Colors.border,
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Handle */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: Colors.muted,
                alignSelf: "center",
                marginBottom: 20,
              }}
            />

            {/* Title */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 16,
                  backgroundColor: `${Colors.primary}1A`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={Colors.primary}
                />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: Colors.foreground,
                  }}
                >
                  Reporter le RDV
                </Text>
                <Text
                  style={{ fontSize: 12, color: Colors.mutedForeground }}
                >
                  {booking.prestation_name}
                </Text>
              </View>
            </View>

            {/* Calendar */}
            <View
              style={{
                backgroundColor: Colors.background,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: Colors.muted,
              }}
            >
              <MiniCalendar
                selectedDate={selectedDate}
                onSelect={handleSelectDate}
                availableDates={availableDates}
                onMonthChange={fetchDates}
              />
            </View>

            {/* Slots */}
            {selectedDate && (
              <View style={{ marginBottom: 20 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <Ionicons
                    name="time-outline"
                    size={12}
                    color={Colors.mutedForeground}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: Colors.mutedForeground,
                    }}
                  >
                    Créneaux disponibles
                  </Text>
                </View>
                {loadingSlots ? (
                  <View
                    style={{ paddingVertical: 16, alignItems: "center" }}
                  >
                    <ActivityIndicator color={Colors.primary} />
                  </View>
                ) : slots.length === 0 ? (
                  <View
                    style={{
                      paddingVertical: 16,
                      alignItems: "center",
                      backgroundColor: `${Colors.muted}4D`,
                      borderRadius: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: Colors.mutedForeground,
                      }}
                    >
                      Aucun créneau disponible ce jour
                    </Text>
                  </View>
                ) : (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {slots.map((slot) => (
                      <Pressable
                        key={slot.id}
                        onPress={() => setSelectedSlot(slot)}
                        style={{
                          width: "22%",
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor:
                            selectedSlot?.id === slot.id
                              ? Colors.primary
                              : Colors.muted,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color:
                              selectedSlot?.id === slot.id
                                ? "#fff"
                                : Colors.foreground,
                          }}
                        >
                          {slot.time}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={onClose}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: Colors.muted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: Colors.foreground,
                    fontWeight: "600",
                    fontSize: 15,
                  }}
                >
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                disabled={!selectedDate || !selectedSlot || isSubmitting}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: Colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: !selectedDate || !selectedSlot ? 0.4 : 1,
                  shadowColor: Colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "600",
                      fontSize: 15,
                    }}
                  >
                    Confirmer
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Waiting List Section ──────────────────────────────────────────────────────

function WaitingListSection() {
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery<WaitingEntry[]>({
    queryKey: ["client-waiting-list"],
    queryFn: async () => {
      const res = await nailTechApi.getMyWaitingList();
      if (!res.success) return [];
      return (res.data ?? []) as WaitingEntry[];
    },
    staleTime: 60_000,
  });

  const leaveMutation = useMutation({
    mutationFn: (proId: number) => nailTechApi.leaveWaitingList(proId),
    onSuccess: (_: unknown, proId: number) => {
      queryClient.setQueryData<WaitingEntry[]>(
        ["client-waiting-list"],
        (prev = []) => prev.filter((e) => e.pro_id !== proId)
      );
    },
  });

  if (isLoading || entries.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(200).springify()}
      style={{ paddingHorizontal: 20, marginTop: 24 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <Ionicons name="notifications-outline" size={15} color="#F59E0B" />
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: Colors.foreground,
          }}
        >
          Listes d'attente
        </Text>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: "#FEF3C7",
          }}
        >
          <Text
            style={{ fontSize: 10, fontWeight: "700", color: "#D97706" }}
          >
            {entries.length}
          </Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {entries.map((entry) => (
          <View
            key={entry.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: 16,
              backgroundColor: Colors.card,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            {entry.pro_photo ? (
              <Image
                source={{ uri: entry.pro_photo }}
                style={{ width: 40, height: 40, borderRadius: 12 }}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={[Colors.primary, `${Colors.primary}B3`]}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Text
                  style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}
                >
                  {entry.pro_name.charAt(0)}
                </Text>
              </LinearGradient>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontWeight: "600",
                  color: Colors.foreground,
                  fontSize: 14,
                }}
              >
                {entry.pro_name}
              </Text>
              {entry.prestation_name && (
                <Text
                  style={{ fontSize: 12, color: Colors.mutedForeground }}
                >
                  {entry.prestation_name}
                </Text>
              )}
              {entry.preferred_date && (
                <Text
                  style={{ fontSize: 12, color: Colors.mutedForeground }}
                >
                  Souhaité :{" "}
                  {new Date(entry.preferred_date).toLocaleDateString("fr-FR")}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => leaveMutation.mutate(entry.pro_id)}
              disabled={leaveMutation.isPending}
              style={{
                padding: 8,
                borderRadius: 12,
                backgroundColor: Colors.muted,
                flexShrink: 0,
              }}
            >
              {leaveMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.mutedForeground} />
              ) : (
                <Ionicons
                  name="notifications-off-outline"
                  size={14}
                  color={Colors.mutedForeground}
                />
              )}
            </Pressable>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ── Booking card components ───────────────────────────────────────────────────

function UpcomingBookingCard({
  booking,
  onReschedule,
  onCancel,
}: {
  booking: Booking;
  onReschedule: (b: Booking) => void;
  onCancel: (id: number) => void;
}) {
  const router = useRouter();
  const proName =
    booking.activity_name ||
    `${booking.pro_first_name} ${booking.pro_last_name}`.trim() ||
    "Professionnelle";
  const dateStr = new Date(booking.start_datetime).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    weekday: "short",
  });
  const timeStr = new Date(booking.start_datetime).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View
      style={{
        backgroundColor: Colors.card,
        borderRadius: 24,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: `${Colors.primary}33`,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
        marginBottom: 12,
      }}
    >
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/booking/[id]",
            params: { id: booking.id },
          })
        }
        style={{ padding: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={{ position: "relative" }}>
            {booking.profile_photo ? (
              <Image
                source={{ uri: booking.profile_photo }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                }}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={[Colors.primary, `${Colors.primary}B3`]}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "700",
                    color: "#fff",
                  }}
                >
                  {proName[0]}
                </Text>
              </LinearGradient>
            )}
            <View
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: "#22C55E",
                borderWidth: 2,
                borderColor: Colors.card,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: Colors.foreground,
                }}
              >
                {proName}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.mutedForeground}
              />
            </View>
            <Text
              style={{
                fontSize: 14,
                color: Colors.mutedForeground,
                marginBottom: 8,
                fontWeight: "500",
              }}
            >
              {booking.prestation_name}
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: `${Colors.muted}80`,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={Colors.mutedForeground}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "500",
                    color: Colors.mutedForeground,
                  }}
                >
                  {dateStr.split(" ").slice(0, 3).join(" ")}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: `${Colors.primary}1A`,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={Colors.primary}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: Colors.primary,
                  }}
                >
                  {timeStr}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Action row */}
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderTopColor: Colors.muted,
        }}
      >
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/booking/[id]",
              params: { id: booking.id },
            })
          }
          style={{
            flex: 1,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderRightWidth: 1,
            borderRightColor: Colors.muted,
          }}
        >
          <Ionicons
            name="calendar-outline"
            size={14}
            color={Colors.mutedForeground}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: Colors.mutedForeground,
            }}
          >
            Détails
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onReschedule(booking)}
          style={{
            flex: 1,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Ionicons
            name="calendar-clear-outline"
            size={14}
            color={Colors.primary}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: Colors.primary,
            }}
          >
            Reporter
          </Text>
        </Pressable>
      </View>

      {/* Cancel row */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: Colors.muted,
        }}
      >
        <Pressable
          onPress={() => onCancel(booking.id)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: `${Colors.destructive}0D`,
            borderWidth: 1,
            borderColor: `${Colors.destructive}26`,
          }}
        >
          <Ionicons
            name="close-circle-outline"
            size={14}
            color={Colors.destructive}
          />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: Colors.destructive,
            }}
          >
            Annuler le rendez-vous
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PastBookingCard({ booking }: { booking: Booking }) {
  const router = useRouter();
  const proName =
    booking.activity_name ||
    `${booking.pro_first_name} ${booking.pro_last_name}`.trim() ||
    "Professionnelle";
  const dateStr = new Date(booking.start_datetime).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    weekday: "short",
  });
  const timeStr = new Date(booking.start_datetime).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const isCompleted = booking.status === "completed";
  const price =
    typeof booking.price === "number"
      ? booking.price
      : parseFloat(String(booking.price ?? "0")) || 0;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/booking/[id]",
          params: { id: booking.id },
        })
      }
      style={{
        backgroundColor: Colors.card,
        borderRadius: 24,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: Colors.muted,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
        marginBottom: 8,
        padding: 16,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {booking.profile_photo ? (
          <Image
            source={{ uri: booking.profile_photo }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              opacity: 0.7,
            }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: `${Colors.primary}1A`,
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.7,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: Colors.primary,
              }}
            >
              {proName[0]}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontWeight: "600",
                color: Colors.foreground,
                fontSize: 14,
              }}
            >
              {proName}
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: isCompleted ? "#DCFCE7" : "#F3F4F6",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: isCompleted ? "#16A34A" : "#6B7280",
                }}
              >
                {isCompleted ? "✓ Terminé" : "✕ Annulé"}
              </Text>
            </View>
          </View>
          <Text
            style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 8 }}
          >
            {booking.prestation_name} • {price.toFixed(2)}€
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={10}
                color={Colors.mutedForeground}
              />
              <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>
                {dateStr.split(" ").slice(0, 3).join(" ")}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Ionicons
                name="time-outline"
                size={10}
                color={Colors.mutedForeground}
              />
              <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>
                {timeStr}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={Colors.mutedForeground}
          style={{ flexShrink: 0 }}
        />
      </View>
    </Pressable>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MyBookingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["client-bookings"],
    queryFn: async () => {
      const res = await clientApi.getMyBookings();
      if (!res.success || !Array.isArray(res.data)) return [];
      return (res.data as Array<Record<string, unknown>>).map((b) => ({
        id: b.id as number,
        pro_id:
          ((b.pro as Record<string, unknown>)?.id as number) ||
          (b.pro_id as number),
        start_datetime: b.start_datetime as string,
        end_datetime: b.end_datetime as string,
        status: b.status as Booking["status"],
        price: b.price as number | string,
        paid_online: b.paid_online as boolean,
        prestation_name:
          ((b.prestation as Record<string, unknown>)?.name as string) ||
          (b.prestation_name as string) ||
          "Prestation",
        duration_minutes:
          ((b.prestation as Record<string, unknown>)
            ?.duration_minutes as number) || 60,
        pro_first_name:
          ((b.pro as Record<string, unknown>)?.first_name as string) ||
          (b.pro_first_name as string) ||
          "",
        pro_last_name:
          ((b.pro as Record<string, unknown>)?.last_name as string) ||
          (b.pro_last_name as string) ||
          "",
        activity_name:
          ((b.pro as Record<string, unknown>)?.activity_name as
            | string
            | null) ||
          (b.activity_name as string | null) ||
          null,
        profile_photo:
          ((b.pro as Record<string, unknown>)?.profile_photo as
            | string
            | null) ||
          (b.profile_photo as string | null) ||
          null,
        city:
          ((b.pro as Record<string, unknown>)?.city as string | null) ||
          (b.city as string | null) ||
          null,
        cancellation_notice_hours:
          ((b.pro as Record<string, unknown>)
            ?.cancellation_notice_hours as number) ?? 24,
      })) as Booking[];
    },
    staleTime: 30_000,
  });

  const handleReschedule = useCallback(
    async (
      bookingId: number,
      startDt: string,
      endDt: string,
      slotId: number | null
    ) => {
      const snapshot = queryClient.getQueryData<Booking[]>(["client-bookings"]);
      queryClient.setQueryData<Booking[]>(["client-bookings"], (prev = []) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, start_datetime: startDt, end_datetime: endDt }
            : b
        )
      );
      setRescheduleBooking(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/client/my-booking/${bookingId}/reschedule`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              start_datetime: startDt,
              end_datetime: endDt,
              slot_id: slotId,
            }),
          }
        );
        const d = (await res.json()) as { success: boolean; message?: string };
        if (!d.success) throw new Error(d.message ?? "Erreur");
      } catch (err) {
        if (snapshot) queryClient.setQueryData(["client-bookings"], snapshot);
        Alert.alert(
          "Erreur",
          err instanceof Error ? err.message : "Erreur lors du report"
        );
      }
    },
    [queryClient]
  );

  const handleCancel = useCallback((id: number) => {
    Alert.alert(
      "Annuler le rendez-vous",
      "Cette action est définitive. Tu devras reprendre un nouveau rendez-vous si tu changes d'avis.",
      [
        { text: "Retour", style: "cancel" },
        {
          text: "Confirmer",
          style: "destructive",
          onPress: async () => {
            try {
              await clientApi.cancelReservationWithPolicy(id);
              await queryClient.invalidateQueries({
                queryKey: ["client-bookings"],
              });
            } catch {
              Alert.alert("Erreur", "Impossible d'annuler le rendez-vous");
            }
          },
        },
      ]
    );
  }, [queryClient]);

  const bookings = (data as Booking[] | undefined) ?? [];
  const now = new Date();
  const upcomingBookings = bookings.filter(
    (b) =>
      (b.status === "confirmed" || b.status === "pending") &&
      new Date(b.start_datetime) > now
  );
  const pastBookings = bookings.filter(
    (b) =>
      b.status === "completed" ||
      b.status === "cancelled" ||
      new Date(b.start_datetime) <= now
  );
  const hasOnlyPastBookings =
    upcomingBookings.length === 0 && pastBookings.length > 0;

  if (isLoading) {
    return (
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          paddingTop: insets.top,
        }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24 }}
      >
        <View
          style={{
            height: 32,
            width: 192,
            backgroundColor: Colors.muted,
            borderRadius: 12,
            marginBottom: 8,
          }}
        />
        <View
          style={{
            height: 16,
            width: 128,
            backgroundColor: Colors.muted,
            borderRadius: 8,
            marginBottom: 24,
          }}
        />
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              backgroundColor: Colors.card,
              borderRadius: 24,
              padding: 20,
              borderWidth: 1,
              borderColor: Colors.muted,
              marginBottom: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  backgroundColor: Colors.muted,
                }}
              />
              <View style={{ flex: 1, gap: 8 }}>
                <View
                  style={{
                    height: 20,
                    width: "50%",
                    backgroundColor: Colors.muted,
                    borderRadius: 6,
                  }}
                />
                <View
                  style={{
                    height: 16,
                    width: "40%",
                    backgroundColor: Colors.muted,
                    borderRadius: 6,
                  }}
                />
                <View
                  style={{
                    height: 12,
                    width: "65%",
                    backgroundColor: Colors.muted,
                    borderRadius: 6,
                  }}
                />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          paddingTop: insets.top,
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: `${Colors.destructive}1A`,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Ionicons name="close-circle-outline" size={40} color={Colors.destructive} />
        </View>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: Colors.foreground,
            marginBottom: 8,
          }}
        >
          Oups !
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: Colors.mutedForeground,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Impossible de charger tes réservations
        </Text>
        <Pressable
          onPress={() => void refetch()}
          style={{
            paddingHorizontal: 32,
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: Colors.primary,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          paddingTop: insets.top,
        }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(50).springify()}
          style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, alignItems: "center" }}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: Colors.foreground,
              letterSpacing: -0.5,
            }}
          >
            Mes réservations
          </Text>
        </Animated.View>

        {/* CTA if only past bookings */}
        {hasOnlyPastBookings && (
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            style={{ paddingHorizontal: 20, marginBottom: 24 }}
          >
            <LinearGradient
              colors={[`${Colors.primary}1A`, `${Colors.primary}0D`, "transparent"]}
              style={{
                borderRadius: 24,
                padding: 24,
                borderWidth: 2,
                borderColor: `${Colors.primary}33`,
                overflow: "hidden",
              }}
            >
              <Ionicons
                name="sparkles-outline"
                size={48}
                color={`${Colors.primary}33`}
                style={{ position: "absolute", top: 8, right: 8 }}
              />
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: Colors.foreground,
                  marginBottom: 8,
                }}
              >
                Prête pour un nouveau soin ?
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: Colors.mutedForeground,
                  marginBottom: 16,
                }}
              >
                Retrouve nos expertes et réserve ta prochaine prestation en
                quelques clics !
              </Text>
              <Pressable
                onPress={() => router.push("/(client)/specialists")}
                style={{
                  paddingVertical: 12,
                  borderRadius: 16,
                  backgroundColor: Colors.primary,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  shadowColor: Colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Ionicons name="sparkles-outline" size={18} color="#fff" />
                <Text
                  style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}
                >
                  Réserve dès maintenant
                </Text>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Empty state */}
        {bookings.length === 0 ? (
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 80,
              paddingHorizontal: 24,
            }}
          >
            <View
              style={{
                width: 128,
                height: 128,
                borderRadius: 64,
                backgroundColor: `${Colors.primary}1A`,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={64}
                color={Colors.primary}
              />
            </View>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: Colors.foreground,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Aucune réservation
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: Colors.mutedForeground,
                textAlign: "center",
                marginBottom: 32,
                maxWidth: 280,
              }}
            >
              Réserve auprès de nos expertes pour retrouver tes rendez-vous ici
            </Text>
            <Pressable
              onPress={() => router.push("/(client)/specialists")}
              style={{
                paddingHorizontal: 40,
                paddingVertical: 16,
                borderRadius: 24,
                backgroundColor: Colors.primary,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Ionicons name="sparkles-outline" size={20} color="#fff" />
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "600",
                  fontSize: 17,
                }}
              >
                Découvrir les expertes
              </Text>
            </Pressable>
          </Animated.View>
        ) : (
          <View style={{ gap: 24, paddingHorizontal: 20 }}>
            {/* Upcoming */}
            {upcomingBookings.length > 0 && (
              <Animated.View entering={FadeInDown.delay(100).springify()}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: Colors.primary,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: Colors.foreground,
                    }}
                  >
                    À venir
                  </Text>
                </View>
                {upcomingBookings.map((b) => (
                  <UpcomingBookingCard
                    key={b.id}
                    booking={b}
                    onReschedule={setRescheduleBooking}
                    onCancel={handleCancel}
                  />
                ))}
              </Animated.View>
            )}

            {/* Past */}
            {pastBookings.length > 0 && (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: Colors.foreground,
                    }}
                  >
                    Historique
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.mutedForeground,
                    }}
                  >
                    ({pastBookings.length})
                  </Text>
                </View>
                {pastBookings.map((b) => (
                  <PastBookingCard key={b.id} booking={b} />
                ))}
              </Animated.View>
            )}
          </View>
        )}

        <WaitingListSection />
      </ScrollView>

      {rescheduleBooking && (
        <RescheduleModal
          booking={rescheduleBooking}
          onClose={() => setRescheduleBooking(null)}
          onConfirm={(startDt, endDt, slotId) =>
            handleReschedule(rescheduleBooking.id, startDt, endDt, slotId)
          }
        />
      )}
    </>
  );
}
