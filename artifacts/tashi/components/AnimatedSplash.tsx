import React, { useEffect } from "react";
import { Dimensions, Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

interface Props {
  onFinish: () => void;
}

export default function AnimatedSplash({ onFinish }: Props) {
  const logoScale = useSharedValue(0.25);
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(30);

  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(20);

  const dotsOpacity = useSharedValue(0);

  const screenOpacity = useSharedValue(1);

  const ringScale = useSharedValue(0.6);
  const ringOpacity = useSharedValue(0);

  useEffect(() => {
    // Ring pulse in
    ringOpacity.value = withTiming(0.25, { duration: 600 });
    ringScale.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });

    // Logo enters with spring
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    logoScale.value = withDelay(
      200,
      withSpring(1, { damping: 14, stiffness: 120, mass: 0.8 })
    );
    logoTranslateY.value = withDelay(
      200,
      withSpring(0, { damping: 16, stiffness: 140 })
    );

    // Tagline fades up
    taglineOpacity.value = withDelay(800, withTiming(1, { duration: 500 }));
    taglineTranslateY.value = withDelay(
      800,
      withSpring(0, { damping: 18, stiffness: 150 })
    );

    // Dots fade in
    dotsOpacity.value = withDelay(1100, withTiming(1, { duration: 400 }));

    // Ring pulses out slowly
    ringOpacity.value = withDelay(
      600,
      withSequence(
        withTiming(0.18, { duration: 800 }),
        withTiming(0.1, { duration: 600 })
      )
    );

    // Fade out the whole screen and call onFinish
    screenOpacity.value = withDelay(
      2600,
      withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      })
    );
  }, []);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }, { translateY: logoTranslateY.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));
  const dotsStyle = useAnimatedStyle(() => ({ opacity: dotsOpacity.value }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, screenStyle]}>
      <LinearGradient
        colors={["#1A1A1A", "#111111", "#0D0D0D"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow behind logo */}
      <Animated.View style={[styles.glow, ringStyle]} />

      {/* Decorative ring */}
      <Animated.View style={[styles.ring, ringStyle]} />

      {/* Logo */}
      <Animated.View style={[styles.logoWrapper, logoStyle]}>
        <Image
          source={require("@/assets/images/tashi-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, taglineStyle]}>
        Earn. Redeem. Grow.
      </Animated.Text>

      {/* Bottom dots */}
      <Animated.View style={[styles.dotsRow, dotsStyle]}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </Animated.View>
    </Animated.View>
  );
}

const LOGO_SIZE = width * 0.55;
const RING_SIZE = LOGO_SIZE * 1.7;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  glow: {
    position: "absolute",
    width: RING_SIZE * 1.1,
    height: RING_SIZE * 1.1,
    borderRadius: RING_SIZE,
    backgroundColor: "#E87722",
  },
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE,
    borderWidth: 1.5,
    borderColor: "#E87722",
    backgroundColor: "transparent",
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  tagline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 2.5,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    marginBottom: 60,
  },
  dotsRow: {
    position: "absolute",
    bottom: 60,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  dotActive: {
    width: 22,
    borderRadius: 3,
    backgroundColor: "#E87722",
  },
});
