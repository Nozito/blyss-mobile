import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { storage } from "@/lib/storage";
import { notificationsApi } from "@/lib/api";

// Notification types that mean "Mes avis" is now stale — a pro looking at
// that screen when the admin acts should see the change without having to
// pull-to-refresh herself.
const REVIEW_MODERATION_TYPES = new Set(["review_deleted", "review_restored"]);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationItem {
  id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (n: NotificationItem) => void;
  markAsRead: (id: number) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? "";

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  const addNotification = useCallback((n: NotificationItem) => {
    setNotifications((prev) => [n, ...prev.filter((p) => p.id !== n.id)]);
  }, []);

  const markAsRead = useCallback((id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  // Fix #4 — user?.id (primitive) au lieu de user (objet) : évite de reconnecter le WS
  // deux fois au boot quand AuthContext fait setUser(cache) puis setUser(response.data)
  useEffect(() => {
    if (!isAuthenticated || !user) {
      wsRef.current?.close();
      return;
    }

    let active = true;

    const connect = async () => {
      const token = await storage.getAccessToken();
      if (!token || !WS_URL || !active) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "auth", token }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            notification?: NotificationItem;
            data?: NotificationItem & { title?: string };
          };
          // Backend sends { type: "new_notification", data: notif }; keep compat with "notification"
          const notif = msg.notification ?? msg.data;
          if ((msg.type === "notification" || msg.type === "new_notification") && notif) {
            addNotification(notif);
            if (REVIEW_MODERATION_TYPES.has(notif.type)) {
              void queryClient.invalidateQueries({ queryKey: ["pro-reviews"] });
            }
            void Notifications.scheduleNotificationAsync({
              content: {
                title: (notif as { title?: string }).title ?? "Blyss",
                body: notif.message,
                data: { type: notif.type, ...(notif.data ?? {}) },
              },
              trigger: null,
            });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (active) reconnectTimeout.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  // user?.id stable (primitive) — pas de reconnexion sur chaque re-render d'AuthContext
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }
    notificationsApi.getAll().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setNotifications(res.data as NotificationItem[]);
      }
    }).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === "web") return;

    const registerPushToken = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;

      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        if (!projectId) return;
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        await notificationsApi.savePushToken(tokenData.data);
      } catch {
        // Non-fatal
      }
    };

    void registerPushToken();
  }, [isAuthenticated]);

  // Notif reçue en foreground via APNs (hors WS) → resync la liste depuis le serveur
  useEffect(() => {
    if (!isAuthenticated || Platform.OS === "web") return;
    const sub = Notifications.addNotificationReceivedListener((event) => {
      notificationsApi.getAll().then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setNotifications(res.data as NotificationItem[]);
        }
      }).catch(() => {});
      const notifType = event.request.content.data?.type as string | undefined;
      if (notifType && REVIEW_MODERATION_TYPES.has(notifType)) {
        void queryClient.invalidateQueries({ queryKey: ["pro-reviews"] });
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, queryClient]);

  // Fix #5 — [user?.role] au lieu de [user, router] : seul le rôle détermine la
  // destination ; router est un singleton stable dans Expo Router
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const reservationId = data?.reservation_id;
      const notifType = data?.type as string | undefined;

      // Marque la notif correspondante comme lue (local + serveur) — sans ça, une
      // notification ouverte depuis le lock screen laissait le badge de non-lues
      // bloqué, car seul le tap depuis la liste in-app appelait markAsRead.
      setNotifications((prev) => {
        // Filtre aussi par type : deux notifs non lues peuvent partager le même
        // reservation_id ("confirmée" + "rappel 24h avant") — sans ce filtre,
        // .find() marquait la mauvaise comme lue (la première du tableau).
        const match = prev.find(
          (n) =>
            !n.is_read &&
            reservationId != null &&
            n.data?.reservation_id === reservationId &&
            (notifType == null || n.type === notifType)
        );
        if (!match) return prev;
        notificationsApi.markAsRead(match.id).catch(() => {});
        return prev.map((n) => (n.id === match.id ? { ...n, is_read: true } : n));
      });

      if (user?.role === "client") {
        if (reservationId) {
          router.push(`/booking/${String(reservationId)}` as never);
        } else {
          router.push("/(client)/notifications" as never);
        }
      } else {
        // new_booking → open agenda directly so pro sees the slot immediately
        if (notifType === "new_booking") {
          router.push("/(pro)/calendar" as never);
        } else {
          router.push("/(pro)/notifications" as never);
        }
      }
    });
    return () => sub.remove();
  // router exclu : singleton stable ; user?.role seul détermine la destination
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const contextValue = useMemo(
    () => ({ notifications, unreadCount, addNotification, markAsRead, clearAll }),
    // addNotification, markAsRead, clearAll are stable (useCallback with [] deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notifications, unreadCount]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
