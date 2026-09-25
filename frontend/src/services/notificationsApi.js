import { apiRequest } from "./apiClient";

export const getNotifications = () => apiRequest("/notifications").then((data) => data.notifications);
export const markNotificationRead = (notificationId) => apiRequest(`/notifications/${notificationId}/read`, { method: "POST" });
export const markAllNotificationsRead = () => apiRequest("/notifications/read-all", { method: "POST" });
