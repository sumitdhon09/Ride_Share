const isBrowser = typeof window !== "undefined";
const defaultApiBase = import.meta.env.DEV
  ? isBrowser
    ? `http://${window.location.hostname || "127.0.0.1"}:8080`
    : "http://127.0.0.1:8080"
  : isBrowser
    ? window.location.origin
    : "";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase)
  .trim()
  .replace(/\/+$/, "");
export const API_BASE_URL = API_BASE;

function clearStoredSession(notify = false) {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");

  if (notify && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rideshare:session-expired"));
  }
}

function getApiBaseCandidates(apiBase) {
  const candidates = [apiBase];

  try {
    const baseUrl = new URL(apiBase);
    if (baseUrl.hostname === "localhost") {
      baseUrl.hostname = "127.0.0.1";
      candidates.push(baseUrl.toString().replace(/\/+$/, ""));
    } else if (baseUrl.hostname === "127.0.0.1") {
      baseUrl.hostname = "localhost";
      candidates.push(baseUrl.toString().replace(/\/+$/, ""));
    }
  } catch {
    return candidates;
  }

  return [...new Set(candidates)];
}

const API_BASE_CANDIDATES = getApiBaseCandidates(API_BASE);

async function readResponseBody(response) {
  if (response.status === 204) {
    return null;
  }

  const rawText = await response.text();
  if (!rawText) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return JSON.parse(rawText);
  }

  return rawText;
}

async function requestAtBase(baseUrl, cleanedPath, method, headers, body) {
  return fetch(`${baseUrl}${cleanedPath}`, {
    method: method.toUpperCase(),
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
}

async function tryRefreshAccessToken(baseUrl) {
  const refreshToken = localStorage.getItem("refreshToken") || "";
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await readResponseBody(response);
    const nextAccessToken = payload?.accessToken || payload?.token || "";
    const nextRefreshToken = payload?.refreshToken || refreshToken;
    if (!nextAccessToken) {
      return null;
    }

    localStorage.setItem("token", nextAccessToken);
    localStorage.setItem("refreshToken", nextRefreshToken);
    if (payload?.role) {
      localStorage.setItem("role", payload.role);
    }
    if (payload?.name) {
      localStorage.setItem("name", payload.name);
    }
    if (payload?.id !== undefined && payload?.id !== null) {
      localStorage.setItem("userId", String(payload.id));
    }
    return nextAccessToken;
  } catch {
    return null;
  }
}

export async function apiRequest(path, method = "GET", body = null, token = null) {
  const cleanedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = {};

  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  for (const baseUrl of API_BASE_CANDIDATES) {
    try {
      response = await requestAtBase(baseUrl, cleanedPath, method, headers, body);

      const canTryRefresh =
        response.status === 401 &&
        Boolean(headers.Authorization) &&
        cleanedPath !== "/auth/login" &&
        cleanedPath !== "/auth/refresh" &&
        cleanedPath !== "/auth/signup";

      if (canTryRefresh) {
        const nextAccessToken = await tryRefreshAccessToken(baseUrl);
        if (nextAccessToken) {
          const retryHeaders = { ...headers, Authorization: `Bearer ${nextAccessToken}` };
          response = await requestAtBase(baseUrl, cleanedPath, method, retryHeaders, body);
        } else {
          clearStoredSession(true);
        }
      }
      break;
    } catch {
      // Try the next local loopback candidate before failing.
    }
  }

  if (!response) {
    throw new Error(`Unable to connect to backend at ${API_BASE_CANDIDATES.join(" or ")}.`);
  }

  const payload = await readResponseBody(response);
  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && Boolean(headers.Authorization)) {
      clearStoredSession(true);
      throw new Error("Session expired. Please login again.");
    }
    if (typeof payload === "string" && payload.trim()) {
      throw new Error(payload);
    }
    if (payload && typeof payload === "object" && payload.message) {
      throw new Error(payload.message);
    }
    throw new Error(`Request failed with status ${response.status}`);
  }

  return payload;
}
