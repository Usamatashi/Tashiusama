import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const W = SCREEN_WIDTH - 32;
const IMG_RATIO = 1000 / 667;
const H = (W / IMG_RATIO) * 1.2;

interface QuickAction {
  label: string;
  desc: string;
  route: string;
  icon?: React.ComponentProps<typeof Feather>["name"];
  iconColor?: string;
  iconBg?: string;
}

interface Props {
  leftAction: QuickAction;
  rightAction: QuickAction;
  centerRoute: string;
  centerLabel?: string;
}

export function BrakePadCard({ leftAction, rightAction, centerRoute, centerLabel = "ORDER" }: Props) {
  return (
    <View style={[styles.wrapper, { height: H }]}>
      <Image
        source={require("../assets/images/quick-actions-card.jpg")}
        style={styles.image}
        resizeMode="cover"
      />

      {/* Left label overlay */}
      <View style={styles.leftLabelBox} pointerEvents="none">
        <View style={[styles.iconCircle, { backgroundColor: leftAction.iconBg ?? "#DCFCE7" }]}>
          <Feather name={leftAction.icon ?? "circle"} size={18} color={leftAction.iconColor ?? "#16A34A"} />
        </View>
        <Text style={styles.overlayTitle}>{leftAction.label}</Text>
        <Text style={styles.overlayDesc}>{leftAction.desc}</Text>
      </View>

      {/* Right label overlay */}
      <View style={styles.rightLabelBox} pointerEvents="none">
        <View style={[styles.iconCircle, { backgroundColor: rightAction.iconBg ?? "#DBEAFE" }]}>
          <Feather name={rightAction.icon ?? "truck"} size={18} color={rightAction.iconColor ?? "#2563EB"} />
        </View>
        <Text style={styles.overlayTitle}>{rightAction.label}</Text>
        <Text style={styles.overlayDesc}>{rightAction.desc}</Text>
      </View>

      {/* Left tap zone */}
      <TouchableOpacity
        style={styles.leftZone}
        onPress={() => router.push(leftAction.route as any)}
        activeOpacity={0.15}
      />

      {/* Right tap zone */}
      <TouchableOpacity
        style={styles.rightZone}
        onPress={() => router.push(rightAction.route as any)}
        activeOpacity={0.15}
      />

      {/* Center tap zone */}
      <TouchableOpacity
        style={styles.centerZone}
        onPress={() => router.push(centerRoute as any)}
        activeOpacity={0.2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: W,
    alignSelf: "center",
    marginTop: 0,
    marginBottom: 8,
    position: "relative",
  },
  image: {
    width: W,
    height: H,
    position: "absolute",
    top: 0,
    left: 0,
  },

  leftLabelBox: {
    position: "absolute",
    left: "8%",
    bottom: "12%",
    width: "33%",
    alignItems: "center",
    gap: 4,
  },
  rightLabelBox: {
    position: "absolute",
    right: "8%",
    bottom: "12%",
    width: "33%",
    alignItems: "center",
    gap: 4,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  overlayTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
    textAlign: "center",
  },
  overlayDesc: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#555",
    textAlign: "center",
  },

  leftZone: {
    position: "absolute",
    left: "8%",
    top: "15%",
    width: "33%",
    height: "70%",
  },
  rightZone: {
    position: "absolute",
    right: "8%",
    top: "15%",
    width: "33%",
    height: "70%",
  },
  centerZone: {
    position: "absolute",
    left: "41%",
    top: "25%",
    width: "18%",
    height: "50%",
    borderRadius: 999,
  },
});
