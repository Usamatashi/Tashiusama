import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface Options {
  userId: number | undefined;
  token: string | null;
  baseUrl: string;
}

export function usePushNotifications({ userId, token, baseUrl }: Options) {
  const registered = useRef(false);

  useEffect(() => {
    if (!userId || !token || registered.current) return;
    if (!Device.isDevice) return;

    registered.current = true;
    registerForPushNotifications(token, baseUrl);
  }, [userId, token, baseUrl]);
}

async function registerForPushNotifications(authToken: string, baseUrl: string) {
  try {
    // Set up Android channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Tashi Notifications",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#E87722",
        sound: "default",
      });
    }

    // Request permission
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return;

    // Get Expo push token (works in Expo Go without a project ID)
    const pushToken = await Notifications.getExpoPushTokenAsync();

    if (!pushToken?.data) return;

    // Register token with backend
    await fetch(`${baseUrl}/api/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: pushToken.data }),
    });
  } catch {
    // Fail silently — push notifications are non-critical
  }
}
