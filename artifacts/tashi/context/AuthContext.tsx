import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { apiOrigin } from "@/lib/apiBase";

export interface AuthUser {
  id: number;
  phone: string;
  name: string | null;
  role: "super_admin" | "admin" | "salesman" | "mechanic" | "retailer";
  points: number;
  city: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY_TOKEN = "tashi_token";
const STORAGE_KEY_USER = "tashi_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (apiOrigin) {
      setBaseUrl(apiOrigin);
    }

    let storedToken: string | null = null;
    setAuthTokenGetter(() => storedToken);

    const restore = async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_TOKEN),
          AsyncStorage.getItem(STORAGE_KEY_USER),
        ]);
        if (savedToken && savedUser) {
          storedToken = savedToken;
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          setAuthTokenGetter(() => storedToken);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const response = await fetch(`${apiOrigin}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Login failed");
    }

    const data = await response.json();
    const { token: newToken, user: newUser } = data;

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY_TOKEN, newToken),
      AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser)),
    ]);

    setToken(newToken);
    setUser(newUser);
    setAuthTokenGetter(() => newToken);
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEY_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEY_USER),
    ]);
    setToken(null);
    setUser(null);
    setAuthTokenGetter(() => null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${apiOrigin}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
      }
    } catch {
      // ignore
    }
  }, [token]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!token) throw new Error("Not authenticated");
    const response = await fetch(`${apiOrigin}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Password change failed");
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
