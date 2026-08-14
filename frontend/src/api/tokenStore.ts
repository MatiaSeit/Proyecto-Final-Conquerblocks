// Small wrapper around localStorage so the rest of the app never touches
// the storage keys directly. Real deployment: swap for httpOnly cookies
// issued by the backend if you want to harden this further.
const ACCESS_KEY = "asc_access_token";
const REFRESH_KEY = "asc_refresh_token";

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  setAccess: (access: string) => localStorage.setItem(ACCESS_KEY, access),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
