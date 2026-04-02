import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";

interface BackButtonProps {
  color?: string;
  onPress?: () => void;
  dark?: boolean;
  fallback?: string;
}

export function BackButton({
  color = Colors.primary,
  onPress,
  dark = false,
  fallback = "/(user)/",
}: BackButtonProps) {
  function handlePress() {
    if (onPress) {
      onPress();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback as any);
    }
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.btn,
        dark
          ? styles.btnDark
          : { backgroundColor: `${color}18`, borderColor: `${color}30` },
      ]}
      activeOpacity={0.7}
    >
      <Feather name="chevron-left" size={22} color={dark ? Colors.white : color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  btnDark: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.35)",
  },
});
