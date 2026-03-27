import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

export interface AuthUser {
  id: number;
  phone: string;
  name: string | null;
  role: "admin" | "salesman" | "mechanic" | "retailer";
  points: number;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY_TOKEN = "tashi_token";
const STORAGE_KEY_USER = "tashi_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
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
    const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    let body: any;
    try {
      body = await res.json();
    } catch {
      throw new Error("Server error. Please try again.");
    }
    if (!res.ok) {
      throw new Error(body?.error || "Login failed");
    }
    const data = body;
    const newToken = data.token as string;
    const newUser = data.user as AuthUser;
    await AsyncStorage.setItem(STORAGE_KEY_TOKEN, newToken);
    await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setAuthTokenGetter(() => newToken);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_KEY_TOKEN, STORAGE_KEY_USER]);
    setToken(null);
    setUser(null);
    setAuthTokenGetter(() => null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const fresh = await res.json() as AuthUser;
        setUser(fresh);
        await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(fresh));
      }
    } catch {
      // ignore
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
