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

export const resendVerification = (email) => apiRequest("/auth/resend-verification", {
  method: "POST", body: JSON.stringify({ email }), retryOnUnauthorized: false,
});
export const verifyEmail = (token) => apiRequest("/auth/verify-email", {
  method: "POST", body: JSON.stringify({ token }), retryOnUnauthorized: false,
});
export const requestEmailChange = (email) => apiRequest("/auth/change-email", {
  method: "POST", body: JSON.stringify({ email }),
});
