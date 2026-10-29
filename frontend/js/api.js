/**
 * Central API client for TrueShift.
 * Every page includes this file before its own page-specific script.
 */
const API_BASE_URL = "http://localhost:8000/api/v1";

const TokenStore = {
  getAccess() { return localStorage.getItem("access_token"); },
  getRefresh() { return localStorage.getItem("refresh_token"); },
  set(access, refresh) {
    localStorage.setItem("access_token", access);
    if (refresh) localStorage.setItem("refresh_token", refresh);
  },
  clear() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
  },
  setUser(user) { localStorage.setItem("user", JSON.stringify(user)); },
  getUser() {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  },
};

/**
 * Wraps fetch(): attaches the bearer token, retries once after a silent
 * refresh if the access token has expired, and normalizes error handling.
 */
async function apiRequest(path, { method = "GET", body = null, auth = true, retry = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = TokenStore.getAccess();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && auth && retry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return apiRequest(path, { method, body, auth, retry: false });
    }
    TokenStore.clear();
    window.location.href = "login.html";
    return null;
  }

  const data = await safeJson(response);
  if (!response.ok) {
    const detail = data && (data.message || data.detail);
    const message = (typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(item => item.msg || String(item)).join(', ') : '') || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

async function safeJson(response) {
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function tryRefreshToken() {
  const refresh_token = TokenStore.getRefresh();
  if (!refresh_token) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    TokenStore.set(data.access_token, refresh_token);
    return true;
  } catch {
    return false;
  }
}

function requireAuth() {
  if (!TokenStore.getAccess()) {
    window.location.href = "login.html";
  }
}
