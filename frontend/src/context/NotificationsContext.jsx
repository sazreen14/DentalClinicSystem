import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./useAuth";
import { NotificationsContext } from "./useNotifications";
import {
  getNotifications as fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationsApi";

function relativeTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const elapsed = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

const present = (item) => ({ ...item, timestamp: relativeTimestamp(item.createdAt) });

export function NotificationsProvider({ children }) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setError("");
      return [];
    }
    try {
      const items = (await fetchNotifications()).map(present);
      setNotifications(items);
      setError("");
      return items;
    } catch (requestError) {
      setError(requestError.message);
      return [];
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isInitializing) return;
    queueMicrotask(reload);
  }, [isInitializing, reload, user?.userId]);

  const getNotifications = useCallback(() => notifications, [notifications]);
  const getUnreadCount = useCallback(() => notifications.filter((item) => !item.read).length, [notifications]);

  const markAsRead = useCallback(async (_role, id) => {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.read) return;
    await markNotificationRead(id);
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true, readAt: new Date().toISOString() } : item));
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    if (!notifications.some((item) => !item.read)) return;
    await markAllNotificationsRead();
    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((item) => item.read ? item : { ...item, read: true, readAt }));
  }, [notifications]);

  const value = useMemo(() => ({
    notifications, error, reload, getNotifications, getUnreadCount, markAsRead, markAllAsRead,
  }), [error, getNotifications, getUnreadCount, markAllAsRead, markAsRead, notifications, reload]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
