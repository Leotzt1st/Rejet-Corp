import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "../services/supabase/client";
import {
  getUnreadCount,
  subscribeToNotifications,
} from "../services/notifications/notificationService";
import type { AppNotification } from "../types/notification";
import { useAuth } from "./AuthContext";

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext({} as NotificationContextType);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const profileId = profile?.id ?? user?.id ?? null;
  const firstLoad = useRef(true);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      setNotifications((data ?? []) as AppNotification[]);
      setUnreadCount(
        ((data ?? []) as AppNotification[]).filter((n) => !n.read).length
      );
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      refresh();
      return;
    }
    refresh();
  }, [profileId, refresh]);

  useEffect(() => {
    if (!profileId) return;
    void getUnreadCount(profileId)
      .then(setUnreadCount)
      .catch(() => undefined);

    const unsubscribe = subscribeToNotifications(profileId, (notification) => {
      setNotifications((current) => [notification, ...current]);
      setUnreadCount((current) => current + 1);
    });

    return unsubscribe;
  }, [profileId]);

  const markAllRead = useCallback(async () => {
    if (!profileId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", profileId)
      .eq("read", false);
    setUnreadCount(0);
    setNotifications((current) =>
      current.map((n) => (n.read ? n : { ...n, read: true }))
    );
  }, [profileId]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, refresh, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
