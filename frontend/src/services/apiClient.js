export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "/api" : "http://localhost:5000/api");

let accessToken = null;
let refreshPromise = null;
let onSessionExpired = () => {};
let sessionVersion = 0;
let authQueue = Promise.resolve();

export const getApiSessionVersion = () => sessionVersion;

export function resetApiSession() {
  sessionVersion += 1;
  accessToken = null;
  refreshPromise = null;
  return sessionVersion;
}

function assertSession(version) {
  if (version !== sessionVersion) {
    const error = new Error("The session changed. Please try again.");
    error.code = "SESSION_CHANGED";
    throw error;
  }
}

// Cookie-changing requests must finish in order, including a refresh already
// in flight when logout starts. Old responses still cannot update app state.
function serializeAuth(task) {
  const result = authQueue.then(task);
  authQueue = result.catch(() => {});
  return result;
}

function tokenSubject(token) {
  if (!token) return null;
  try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub; }
  catch { return null; }
}

export function setApiAccessToken(token) {
  accessToken = token || null;
}

export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "The request could not be completed.");
    error.status = response.status;
    error.code = data.code;
    error.details = data.details || [];
    throw error;
  }
  return data;
}

async function parseBlobResponse(response) {
  if (!response.ok) return parseResponse(response);
  return response.blob();
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    const version = sessionVersion;
    const subject = tokenSubject(accessToken);
    const pending = serializeAuth(async () => {
      assertSession(version);
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST", credentials: "include", cache: "no-store",
      });
      const data = await parseResponse(response);
      assertSession(version);
      if (subject && tokenSubject(data.accessToken) !== subject) {
        throw new Error("The signed-in account changed. Please log in again.");
      }
      setApiAccessToken(data.accessToken);
      return data.accessToken;
    }).finally(() => { if (refreshPromise === pending) refreshPromise = null; });
    refreshPromise = pending;
  }
  return refreshPromise;
}

export async function apiRequest(path, options = {}) {
  return request(path, options, parseResponse);
}

export async function apiBlobRequest(path, options = {}) {
  return request(path, options, parseBlobResponse);
}

async function request(path, options, parse) {
  const version = sessionVersion;
  const { retryOnUnauthorized = true, headers, ...requestOptions } = options;
  const execute = (finishingLogout = false) => {
    if (!finishingLogout) assertSession(version);
    return fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(requestOptions.body && !(requestOptions.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    });
  };

  if (["/auth/login", "/auth/logout", "/auth/logout-all"].includes(path)) {
    return serializeAuth(async () => {
      const result = await parse(await execute(path === "/auth/logout" || path === "/auth/logout-all"));
      assertSession(version);
      return result;
    });
  }

  let response = await execute();
  assertSession(version);
  if (response.status === 401 && retryOnUnauthorized && !path.startsWith("/auth/refresh")) {
    try {
      await refreshAccessToken();
      response = await execute();
    } catch (error) {
      if (version === sessionVersion) {
        setApiAccessToken(null);
        onSessionExpired();
      }
      throw error;
    }
  }
  const result = await parse(response);
  assertSession(version);
  return result;
}
