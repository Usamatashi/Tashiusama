import { Feather, FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const W = SCREEN_WIDTH - 32;
const H = 168;
const TAB_W = 24;
const TAB_H = 62;
const TAB_Y = (H - TAB_H) / 2;
const R = 26;
const iM = 8;
const iR = 20;

function outerPath(): string {
  const w = W, h = H, tw = TAB_W, ty = TAB_Y, th = TAB_H, r = R;
  return [
    `M ${tw + r} 0`,
    `L ${w - tw - r} 0`,
    `Q ${w - tw} 0 ${w - tw} ${r}`,
    `L ${w - tw} ${ty}`,
    `L ${w - 4} ${ty + 6}`,
    `Q ${w} ${ty + 8} ${w} ${ty + 14}`,
    `L ${w} ${ty + th - 14}`,
    `Q ${w} ${ty + th - 8} ${w - 4} ${ty + th - 6}`,
    `L ${w - tw} ${ty + th}`,
    `L ${w - tw} ${h - r}`,
    `Q ${w - tw} ${h} ${w - tw - r} ${h}`,
    `L ${tw + r} ${h}`,
    `Q ${tw} ${h} ${tw} ${h - r}`,
    `L ${tw} ${ty + th}`,
    `L ${4} ${ty + th - 6}`,
    `Q ${0} ${ty + th - 8} ${0} ${ty + th - 14}`,
    `L ${0} ${ty + 14}`,
    `Q ${0} ${ty + 8} ${4} ${ty + 6}`,
    `L ${tw} ${ty}`,
    `L ${tw} ${r}`,
    `Q ${tw} 0 ${tw + r} 0`,
    `Z`,
  ].join(" ");
}

function innerPath(): string {
  const x0 = TAB_W + iM;
  const y0 = iM;
  const x1 = W - TAB_W - iM;
  const y1 = H - iM;
  return [
    `M ${x0 + iR} ${y0}`,
    `L ${x1 - iR} ${y0}`,
    `Q ${x1} ${y0} ${x1} ${y0 + iR}`,
    `L ${x1} ${y1 - iR}`,
    `Q ${x1} ${y1} ${x1 - iR} ${y1}`,
    `L ${x0 + iR} ${y1}`,
    `Q ${x0} ${y1} ${x0} ${y1 - iR}`,
    `L ${x0} ${y0 + iR}`,
    `Q ${x0} ${y0} ${x0 + iR} ${y0}`,
    `Z`,
  ].join(" ");
}

interface QuickAction {
  label: string;
  desc: string;
  route: string;
}

interface Props {
  leftAction: QuickAction;
  rightAction: QuickAction;
  centerRoute: string;
  centerLabel?: string;
}

export function BrakePadCard({ leftAction, rightAction, centerRoute, centerLabel = "ORDER" }: Props) {
  const innerX0 = TAB_W + iM;
  const innerX1 = W - TAB_W - iM;
  const innerW = innerX1 - innerX0;
  const CY = H / 2;

  const leftContentX = innerX0 + innerW / 4;
  const rightContentX = innerX0 + (3 * innerW) / 4;

  return (
    <View style={styles.wrapper}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <ClipPath id="innerClip">
            <Path d={innerPath()} />
          </ClipPath>
        </Defs>

        <Path d={outerPath()} fill="#1C1C1E" />

        <G clipPath="url(#innerClip)">
          <Rect x={0} y={0} width={W / 2} height={H} fill="#EDFBF3" />
          <Rect x={W / 2} y={0} width={W / 2} height={H} fill="#EDF5FF" />
          <Rect x={W / 2 - 0.5} y={0} width={1} height={H} fill="rgba(0,0,0,0.07)" />
        </G>

        <Circle cx={W / 2} cy={CY} r={52} fill="#E87722" opacity={0.12} />
        <Circle cx={W / 2} cy={CY} r={40} fill="#E87722" opacity={0.13} />
      </Svg>

      <TouchableOpacity
        style={[styles.halfBtn, { left: innerX0, width: innerW / 2, top: iM, height: H - iM * 2 }]}
        onPress={() => router.push(leftAction.route as any)}
        activeOpacity={0.8}
      >
        <View style={styles.iconBox}>
          <Feather name="clipboard" size={22} color="#2E7D52" />
        </View>
        <Text style={styles.actionTitle}>{leftAction.label}</Text>
        <Text style={styles.actionDesc}>{leftAction.desc}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.halfBtn, { left: W / 2, width: innerW / 2, top: iM, height: H - iM * 2 }]}
        onPress={() => router.push(rightAction.route as any)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconBox, styles.iconBoxBlue]}>
          <FontAwesome name="car" size={20} color="#1E5FA8" />
        </View>
        <Text style={styles.actionTitle}>{rightAction.label}</Text>
        <Text style={styles.actionDesc}>{rightAction.desc}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.centerBtn, { left: W / 2 - 34, top: CY - 34 }]}
        onPress={() => router.push(centerRoute as any)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={["#F5A24B", "#E87722", "#C5611A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.centerGradient}
        >
          <Feather name="plus" size={26} color="#fff" />
          <Text style={styles.centerLabel}>{centerLabel}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: W,
    height: H,
    alignSelf: "center",
    position: "relative",
  },
  halfBtn: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#B8F0CE",
    justifyContent: "center",
    alignItems: "center",
  },
  iconBoxBlue: {
    backgroundColor: "#BFDBFE",
  },
  actionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
    textAlign: "center",
  },
  actionDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#666666",
    textAlign: "center",
  },
  centerBtn: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#E87722",
    shadowOpacity: 0.75,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 18,
  },
  centerGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 1,
  },
  centerLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 1.2,
  },
});
