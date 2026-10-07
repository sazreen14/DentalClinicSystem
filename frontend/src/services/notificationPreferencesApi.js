import { apiRequest } from "./apiClient";

export const getNotificationPreferences = () => apiRequest("/notifications/preferences").then(result => result.preferences);
export const saveNotificationPreferences = preferences => apiRequest("/notifications/preferences", {
  method: "PATCH",
  body: JSON.stringify(preferences),
}).then(result => result.preferences);
