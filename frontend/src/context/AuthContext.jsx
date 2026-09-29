import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, getApiSessionVersion, resetApiSession, refreshAccessToken, setApiAccessToken, setSessionExpiredHandler } from "../services/apiClient";
import { AuthContext } from "./AuthContextObject";
let sharedRestorePromise = null;
const SIGNED_OUT = "dentalClinicSignedOut";
const SESSION_EVENT = "dentalClinicSessionChange";
function signedOut() { try { return localStorage.getItem(SIGNED_OUT) === "true"; } catch { return false; } }
function announceSession(loggedOut) {
  try {
    localStorage.setItem(SIGNED_OUT, String(loggedOut));
    localStorage.setItem(SESSION_EVENT, crypto.randomUUID());
  } catch { /* Storage can be disabled; in-memory isolation still applies. */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionVersion, setSessionVersion] = useState(getApiSessionVersion);

  const clearSession = useCallback(() => {
    setSessionVersion(resetApiSession());
    sharedRestorePromise = null;
    setAccessToken(null);
    setUser(null);
  }, []);

  const restoreSession = useCallback(async () => {
    if (signedOut()) return null;
    const version = getApiSessionVersion();
    if (!sharedRestorePromise) {
      const pending = (async () => {
        const token = await refreshAccessToken();
        const result = await apiRequest("/auth/me", { retryOnUnauthorized: false });
        return { token, user: result.user };
      })().finally(() => { if (sharedRestorePromise === pending) sharedRestorePromise = null; });
      sharedRestorePromise = pending;
    }
    const restored = await sharedRestorePromise;
    if (version !== getApiSessionVersion()) return null;
    setAccessToken(restored.token);
    setUser(restored.user);
    return restored.user;
  }, []);

  useEffect(() => {
    let active = true;
    setSessionExpiredHandler(() => { if (active) clearSession(); });
    const version = getApiSessionVersion();
    queueMicrotask(() => {
      if (!active) return;
      restoreSession().catch(() => { if (active && version === getApiSessionVersion()) clearSession(); })
        .finally(() => { if (active) setIsInitializing(false); });
    });
    const sessionChanged = (event) => { if (event.key === SESSION_EVENT) clearSession(); };
    const pageRestored = (event) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("storage", sessionChanged);
    window.addEventListener("pageshow", pageRestored);
    return () => {
      active = false;
      window.removeEventListener("storage", sessionChanged);
      window.removeEventListener("pageshow", pageRestored);
    };
  }, [clearSession, restoreSession]);

  const login = useCallback(async (credentials) => {
    const version = resetApiSession();
    sharedRestorePromise = null;
    setUser(null);
    setAccessToken(null);
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
      retryOnUnauthorized: false,
    });
    if (version !== getApiSessionVersion()) throw new Error("The session changed. Please log in again.");
    setApiAccessToken(result.accessToken);
    setSessionVersion(version);
    setAccessToken(result.accessToken);
    setUser(result.user);
    announceSession(false);
    return result.user;
  }, []);

  const registerPatient = useCallback((details) => apiRequest("/auth/register/patient", {
    method: "POST",
    body: JSON.stringify(details),
    retryOnUnauthorized: false,
  }), []);

  const logout = useCallback(async () => {
    clearSession();
    announceSession(true);
    // Stay signed out locally even when the network is unavailable.
    await apiRequest("/auth/logout", { method: "POST", retryOnUnauthorized: false }).catch(() => {});
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    const token = accessToken;
    clearSession();
    announceSession(true);
    await apiRequest("/auth/logout-all", { method: "POST", headers: { Authorization: `Bearer ${token}` }, retryOnUnauthorized: false });
  }, [accessToken, clearSession]);

  const value = useMemo(() => ({
    user, accessToken, isAuthenticated: Boolean(user && accessToken), isInitializing,
    registerPatient, login, logout, logoutAll, refreshSession: restoreSession, restoreSession,
  }), [accessToken, isInitializing, login, logout, logoutAll, registerPatient, restoreSession, user]);

  return <AuthContext.Provider value={value}>
    <Fragment key={`${sessionVersion}:${user?.userId || "anonymous"}:${user?.role || ""}`}>
      {children}
    </Fragment>
  </AuthContext.Provider>;
}
