import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { login as loginRequest, meApi } from "../api/endpoints";
import { tokenStore } from "../api/tokenStore";
import type { Me } from "../api/types";

interface AuthContextValue {
  user: Me | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadUser() {
    try {
      const me = await meApi.get();
      setUser(me);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (tokenStore.getAccess()) {
      loadUser();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(username: string, password: string) {
    const { access, refresh } = await loginRequest(username, password);
    tokenStore.set(access, refresh);
    await loadUser();
  }

  function logout() {
    tokenStore.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
