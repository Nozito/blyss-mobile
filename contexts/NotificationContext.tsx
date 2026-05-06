import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useAuth } from "./AuthContext";
import { storage } from "@/lib/storage";

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const addNotification = (n: NotificationItem) => {
    setNotifications((prev) => [n, ...prev.filter((p) => p.id !== n.id)]);
  };

  const markAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const clearAll = () => setNotifications([]);

  // WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !user) {
      wsRef.current?.close();
      return;
    }

    const connect = async () => {
      const token = await storage.getAccessToken();
      if (!token || !WS_URL) return;

      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as { type: string; notification?: NotificationItem };
          if (data.type === "notification" && data.notification) {
            addNotification(data.notification);
            // Show local push notification
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
        reconnectTimeout.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [isAuthenticated, user]);

  // Push notification permissions
  useEffect(() => {
    if (!isAuthenticated) return;

    const requestPermissions = async () => {
      if (Platform.OS === "web") return;
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;
    };

    requestPermissions();
  }, [isAuthenticated]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, addNotification, markAsRead, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
