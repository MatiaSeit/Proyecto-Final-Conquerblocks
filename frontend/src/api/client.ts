import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { tokenStore } from "./tokenStore";

// Falls back to a same-origin relative path -- the free deployment serves
// the frontend as its own Render static site with the API on a different
// Render service, so the real value is set via VITE_API_URL at build time
// (see README > Despliegue). Local dev always overrides this explicitly
// via frontend/.env (copied from .env.example), so the fallback here only
// matters if that file is missing.
const API_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh-once-and-retry: on a 401, try the refresh token exactly once
// before giving up and forcing a re-login. Concurrent 401s share the same
// in-flight refresh promise so we don't hammer the token endpoint.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) throw new Error("No refresh token available");

  const { data } = await axios.post(`${API_URL}/auth/token/refresh/`, { refresh });
  tokenStore.setAccess(data.access);
  return data.access;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const newAccess = await refreshPromise;
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        tokenStore.clear();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);
