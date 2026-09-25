import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, refreshAccessToken, setApiAccessToken, setSessionExpiredHandler } from "../services/apiClient";
import { AuthContext } from "./AuthContextObject";
let sharedRestorePromise = null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const clearSession = useCallback(() => {
    setApiAccessToken(null);
    setAccessToken(null);
    setUser(null);
  }, []);

  const restoreSession = useCallback(async () => {
    if (!sharedRestorePromise) {
      sharedRestorePromise = (async () => {
        const token = await refreshAccessToken();
        const result = await apiRequest("/auth/me", { retryOnUnauthorized: false });
        return { token, user: result.user };
      })().finally(() => { sharedRestorePromise = null; });
    }
    const restored = await sharedRestorePromise;
    setAccessToken(restored.token);
    setUser(restored.user);
    return restored.user;
  }, []);

  useEffect(() => {
    let active = true;
    setSessionExpiredHandler(() => { if (active) clearSession(); });
    queueMicrotask(() => restoreSession().catch(() => { if (active) clearSession(); }).finally(() => { if (active) setIsInitializing(false); }));
    return () => { active = false; };
  }, [clearSession, restoreSession]);

  const login = useCallback(async (credentials) => {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
      retryOnUnauthorized: false,
    });
    setApiAccessToken(result.accessToken);
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const registerPatient = useCallback((details) => apiRequest("/auth/register/patient", {
    method: "POST",
    body: JSON.stringify(details),
    retryOnUnauthorized: false,
  }), []);

  const logout = useCallback(async () => {
    try { await apiRequest("/auth/logout", { method: "POST", retryOnUnauthorized: false }); }
    finally { clearSession(); }
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try { await apiRequest("/auth/logout-all", { method: "POST", retryOnUnauthorized: false }); }
    finally { clearSession(); }
  }, [clearSession]);

  const value = useMemo(() => ({
    user, accessToken, isAuthenticated: Boolean(user && accessToken), isInitializing,
    registerPatient, login, logout, logoutAll, refreshSession: restoreSession, restoreSession,
  }), [accessToken, isInitializing, login, logout, logoutAll, registerPatient, restoreSession, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
