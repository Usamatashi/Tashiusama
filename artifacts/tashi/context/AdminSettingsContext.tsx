import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

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

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

export function AdminSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading: authLoading } = useAuth();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUserEntry[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || isSuperAdmin;

  // Track which token's settings have already been fetched — prevents premature settingsLoaded=true
  const lastLoadedTokenRef = useRef<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    // On first fetch for this token, block rendering until settings arrive
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
    } catch {
      // keep defaults on error
    } finally {
      setIsLoading(false);
      lastLoadedTokenRef.current = token;
      setSettingsLoaded(true);
    }
  }, [token, isSuperAdmin]);

  useEffect(() => {
    // Wait for auth to finish restoring before acting
    if (authLoading) return;

    if (isAdmin && token) {
      fetchSettings();
    } else {
      setSettings(DEFAULT_SETTINGS);
      setSettingsLoaded(true);
    }
  }, [isAdmin, token, fetchSettings, authLoading]);

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
