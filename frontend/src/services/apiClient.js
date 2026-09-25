export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

let accessToken = null;
let refreshPromise = null;
let onSessionExpired = () => {};

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
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(parseResponse)
      .then((data) => {
        setApiAccessToken(data.accessToken);
        return data.accessToken;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function apiRequest(path, options = {}) {
  const { retryOnUnauthorized = true, headers, ...requestOptions } = options;
  const execute = () => fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    credentials: "include",
    headers: {
      ...(requestOptions.body && !(requestOptions.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  let response = await execute();
  if (response.status === 401 && retryOnUnauthorized && !path.startsWith("/auth/refresh")) {
    try {
      await refreshAccessToken();
      response = await execute();
    } catch (error) {
      setApiAccessToken(null);
      onSessionExpired();
      throw error;
    }
  }
  return parseResponse(response);
}

export async function apiBlobRequest(path, options = {}) {
  const { retryOnUnauthorized = true, headers, ...requestOptions } = options;
  const execute = () => fetch(`${API_BASE_URL}${path}`, { ...requestOptions, credentials: "include", headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...headers } });
  let response = await execute();
  if (response.status === 401 && retryOnUnauthorized) {
    try { await refreshAccessToken(); response = await execute(); }
    catch (error) { setApiAccessToken(null); onSessionExpired(); throw error; }
  }
  return parseBlobResponse(response);
}
