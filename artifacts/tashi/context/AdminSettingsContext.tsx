import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "./AuthContext";
import { apiBase } from "@/lib/apiBase";

export type AdminSettings = {
  tab_dashboard: boolean;
  tab_products: boolean;
  tab_users: boolean;
  tab_payments: boolean;
  card_create_qr: boolean;
  card_orders: boolean;
  card_claims: boolean;
  card_create_ads: boolean;
  card_create_text: boolean;
  card_payments: boolean;
  card_commission: boolean;
};

export const DEFAULT_SETTINGS: AdminSettings = {
  tab_dashboard: true,
  tab_products: true,
  tab_users: true,
  tab_payments: true,
  card_create_qr: true,
  card_orders: true,
  card_claims: true,
  card_create_ads: true,
  card_create_text: true,
  card_payments: true,
  card_commission: true,
};

export type AdminUserEntry = {
  id: number;
  name: string | null;
  phone: string;
  role: string;
  settings: AdminSettings;
};

interface AdminSettingsContextType {
  settings: AdminSettings;
  isLoading: boolean;
  settingsLoaded: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: AdminSettings) => Promise<void>;
  adminUsers: AdminUserEntry[];
  isLoadingAdmins: boolean;
  fetchAdminUsers: () => Promise<void>;
  updateAdminUserSettings: (userId: number, settings: AdminSettings) => Promise<void>;
}

const AdminSettingsContext = createContext<AdminSettingsContextType | null>(null);

const BASE = apiBase;

const POLL_INTERVAL_MS = 30_000;

export function AdminSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading: authLoading } = useAuth();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUserEntry[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || isSuperAdmin;

  const lastLoadedTokenRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    if (lastLoadedTokenRef.current !== token) {
      setSettingsLoaded(false);
    }
    setIsLoading(true);
    try {
      const url = isSuperAdmin
        ? `${BASE}/admin-settings`
        : `${BASE}/admin-user-settings/me`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const data = await res.json() as AdminSettings;
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      }
      // On non-ok (e.g. 401/500), keep current settings — do NOT silently
      // fall back to DEFAULT_SETTINGS which would show all tabs as enabled.
    } catch {
      // Network error — keep current settings
    } finally {
      setIsLoading(false);
      lastLoadedTokenRef.current = token;
      setSettingsLoaded(true);
    }
  }, [token, isSuperAdmin]);

  // Periodic poll so settings update automatically while app is open
  const schedulePoll = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(async () => {
      await fetchSettings();
      schedulePoll();
    }, POLL_INTERVAL_MS);
  }, [fetchSettings]);

  const stopPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Initial fetch + start polling when admin is authenticated
  useEffect(() => {
    if (authLoading) return;

    if (isAdmin && token) {
      fetchSettings().then(() => schedulePoll());
    } else {
      setSettings(DEFAULT_SETTINGS);
      setSettingsLoaded(true);
      stopPoll();
    }

    return () => stopPoll();
  }, [isAdmin, token, fetchSettings, authLoading, schedulePoll, stopPoll]);

  // Re-fetch when the app comes back to the foreground
  useEffect(() => {
    if (!isAdmin || !token) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        fetchSettings();
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [isAdmin, token, fetchSettings]);

  const updateSettings = useCallback(async (newSettings: AdminSettings) => {
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`${BASE}/admin-settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newSettings),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as any).error || "Failed to update settings");
    }
    setSettings(newSettings);
  }, [token]);

  const fetchAdminUsers = useCallback(async () => {
    if (!token || !isSuperAdmin) return;
    setIsLoadingAdmins(true);
    try {
      const res = await fetch(`${BASE}/admin-user-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as AdminUserEntry[];
        setAdminUsers(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingAdmins(false);
    }
  }, [token, isSuperAdmin]);

  const updateAdminUserSettings = useCallback(async (userId: number, newSettings: AdminSettings) => {
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`${BASE}/admin-user-settings/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newSettings),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as any).error || "Failed to update admin settings");
    }
    const merged = await res.json() as AdminSettings;
    setAdminUsers((prev) =>
      prev.map((a) => (a.id === userId ? { ...a, settings: merged } : a))
    );
  }, [token]);

  return (
    <AdminSettingsContext.Provider
      value={{
        settings,
        isLoading,
        settingsLoaded,
        fetchSettings,
        updateSettings,
        adminUsers,
        isLoadingAdmins,
        fetchAdminUsers,
        updateAdminUserSettings,
      }}
    >
      {children}
    </AdminSettingsContext.Provider>
  );
}

export function useAdminSettings() {
  const ctx = useContext(AdminSettingsContext);
  if (!ctx) throw new Error("useAdminSettings must be used within AdminSettingsProvider");
  return ctx;
}
