import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

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
