import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  I18nManager,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface TickerMarqueeProps {
  text: string;
  height?: number;
  backgroundColor?: string;
  textColor?: string;
  badge?: string;
  speed?: number;
}

const BADGE_RESERVED = 64;

export default function TickerMarquee({
  text,
  height = 32,
  backgroundColor = "#E87722",
  textColor = "#FFFFFF",
  badge = "LIVE",
  speed = 55,
}: TickerMarqueeProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (trackWidth === 0 || textWidth === 0) return;

    animRef.current?.stop();

    const startX = trackWidth;
    const endX = -textWidth;
    const travelPx = trackWidth + textWidth;
    const duration = (travelPx / speed) * 1000;

    translateX.setValue(startX);

    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: startX,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: endX,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    animRef.current.start();

    return () => {
      animRef.current?.stop();
    };
  }, [trackWidth, textWidth, speed]);

  if (!text) return null;

  return (
    <View style={[styles.container, { height, backgroundColor }]}>
      {badge ? (
        <View style={styles.badge}>
          <View style={styles.liveDot} />
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}

      <View
        style={styles.track}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        {/*
         * Measurement layer — absolutely positioned with a very large explicit
         * width so React Native never clips or wraps the text. The onLayout
         * callback receives the rendered text width, not the container width.
         */}
        <View style={styles.measureLayer} pointerEvents="none">
          <Text
            style={[styles.text, { color: textColor }]}
            numberOfLines={1}
            onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
          >
            {text}
          </Text>
        </View>

        {/* Scrolling text */}
        <Animated.Text
          style={[
            styles.text,
            styles.scrollText,
            { color: textColor, transform: [{ translateX }] },
          ]}
          numberOfLines={1}
        >
          {text}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.8,
  },

  track: {
    flex: 1,
    overflow: "hidden",
    marginLeft: 8,
  },

  measureLayer: {
    position: "absolute",
    opacity: 0,
    width: 9999,
    top: 0,
    left: 0,
  },

  text: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
    includeFontPadding: false,
  },

  scrollText: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
