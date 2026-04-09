import React, { useEffect } from "react";
import { Dimensions, Image, StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");
const LOGO_SIZE = width * 0.52;

interface Props {
  onFinish: () => void;
}

export default function AnimatedSplash({ onFinish }: Props) {
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 400 });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 110, mass: 0.8 });

    screenOpacity.value = withDelay(
      2500,
      withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      })
    );
  }, []);

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
