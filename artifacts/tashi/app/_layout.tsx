import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AdminSettingsProvider } from "@/context/AdminSettingsContext";
import AnimatedSplash from "@/components/AnimatedSplash";
import { usePushNotifications } from "@/hooks/usePushNotifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const RAILWAY_URL = process.env.EXPO_PUBLIC_RAILWAY_URL ?? "";
const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";
function resolveBaseUrl() {
  if (RAILWAY_URL) return RAILWAY_URL.startsWith("http") ? RAILWAY_URL : `https://${RAILWAY_URL}`;
  if (DOMAIN) return `https://${DOMAIN}`;
  return "";
}

function AppContent() {
  const { isLoading: authLoading, user, token } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  usePushNotifications({ userId: user?.id, token, baseUrl: resolveBaseUrl() });

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <AdminSettingsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(user)" />
      </Stack>
      {showSplash && (
        <AnimatedSplash
          onFinish={handleSplashFinish}
          ready={!authLoading}
        />
      )}
    </AdminSettingsProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
