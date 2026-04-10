import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Image, StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");
const LOGO_SIZE = width * 0.52;
const MIN_DURATION = 4000;

interface Props {
  onFinish: () => void;
  ready: boolean;
}

export default function AnimatedSplash({ onFinish, ready }: Props) {
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const screenOpacity = useSharedValue(1);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 400 });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 110, mass: 0.8 });

    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_DURATION);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!minTimeElapsed || !ready || dismissed.current) return;
    dismissed.current = true;

    screenOpacity.value = withTiming(
      0,
      { duration: 400, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onFinish)();
      }
    );
  }, [minTimeElapsed, ready]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, screenStyle]}>
      <Animated.View style={logoStyle}>
        <Image
          source={require("@/assets/images/tashi-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
