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
import { useAuth } from "./AuthContext";
import { storage } from "@/lib/storage";
import { notificationsApi } from "@/lib/api";

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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

      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as { type: string; notification?: NotificationItem };
          if (data.type === "notification" && data.notification) {
            addNotification(data.notification);
            Notifications.scheduleNotificationAsync({
              content: {
                title: "Blyss",
                body: data.notification.message,
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
    const sub = Notifications.addNotificationReceivedListener(() => {
      notificationsApi.getAll().then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setNotifications(res.data as NotificationItem[]);
        }
      }).catch(() => {});
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  // Fix #5 — [user?.role] au lieu de [user, router] : seul le rôle détermine la
  // destination ; router est un singleton stable dans Expo Router
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const reservationId = data?.reservation_id;

      if (user?.role === "client") {
        if (reservationId) {
          router.push(`/booking/${String(reservationId)}` as never);
        } else {
          router.push("/(client)/notifications" as never);
        }
      } else {
        router.push("/(pro)/notifications" as never);
      }
    });
    return () => sub.remove();
  // router exclu : singleton stable ; user?.role seul détermine la destination
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const contextValue = useMemo(
    () => ({ notifications, unreadCount, addNotification, markAsRead, clearAll }),
    [notifications, unreadCount, addNotification, markAsRead, clearAll]
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
