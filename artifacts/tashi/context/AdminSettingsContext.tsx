import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

export type AdminSettings = {
  tab_dashboard: boolean;
  tab_vehicles: boolean;
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
  tab_vehicles: true,
  tab_users: true,
  tab_payments: true,
  card_create_qr: true,
  card_orders: true,
  card_claims: true,
  card_create_ads: true,
  card_create_text: true,
  card_payments: true,
};

interface AdminSettingsContextType {
  settings: AdminSettings;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: AdminSettings) => Promise<void>;
}

const AdminSettingsContext = createContext<AdminSettingsContextType | null>(null);

export function AdminSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/admin-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as AdminSettings;
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      }
    } catch {
      // keep defaults on error
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAdmin && token) {
      fetchSettings();
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
  }, [isAdmin, token, fetchSettings]);

  const updateSettings = useCallback(async (newSettings: AdminSettings) => {
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/admin-settings`, {
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

  return (
    <AdminSettingsContext.Provider value={{ settings, isLoading, fetchSettings, updateSettings }}>
      {children}
    </AdminSettingsContext.Provider>
  );
}

export function useAdminSettings() {
  const ctx = useContext(AdminSettingsContext);
  if (!ctx) throw new Error("useAdminSettings must be used within AdminSettingsProvider");
  return ctx;
}
