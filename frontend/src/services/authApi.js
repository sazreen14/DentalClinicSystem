import { apiRequest } from "./apiClient";

export const changePassword = (values) => apiRequest("/auth/change-password", {
  method: "POST",
  body: JSON.stringify(values),
});

export const requestPasswordReset = (email) => apiRequest("/auth/forgot-password", {
  method: "POST",
  body: JSON.stringify({ email }),
  retryOnUnauthorized: false,
});

export const resetPassword = (values) => apiRequest("/auth/reset-password", {
  method: "POST",
  body: JSON.stringify(values),
  retryOnUnauthorized: false,
});
