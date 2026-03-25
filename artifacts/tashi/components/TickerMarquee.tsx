import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ScrollView,
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

export default function TickerMarquee({
  text,
  height = 32,
  backgroundColor = "#E87722",
  textColor = "#FFFFFF",
  badge = "LIVE",
  speed = 55,
}: TickerMarqueeProps) {
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (textWidth === 0) return;

    animRef.current?.stop();
    translateX.setValue(0);

    const duration = (textWidth / speed) * 1000;

    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -textWidth,
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
  }, [textWidth, speed]);

  if (!text) return null;

  return (
    <View style={[styles.container, { height, backgroundColor }]}>
      {/*
       * Hidden horizontal ScrollView used purely for measurement.
       * onContentSizeChange always returns the true content width — it is
       * never constrained by the screen or parent width, unlike onLayout on
       * a Text element inside a bounded container.
       */}
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.ruler}
        onContentSizeChange={(w) => setTextWidth(w)}
      >
        <Text style={[styles.text, { color: textColor }]}>{text}</Text>
      </ScrollView>

      {/* LIVE badge */}
      {badge ? (
        <View style={styles.badge}>
          <View style={styles.liveDot} />
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}

      {/* Scrolling track */}
      <View style={styles.track}>
        <Animated.Text
          style={[
            styles.text,
            {
              color: textColor,
              width: textWidth || undefined,
              transform: [{ translateX }],
            },
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

  ruler: {
    position: "absolute",
    opacity: 0,
    top: 0,
    left: 0,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    marginLeft: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.22)",
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
    height: 20,
    overflow: "hidden",
    marginLeft: 8,
    justifyContent: "center",
  },

  text: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
    includeFontPadding: false,
    position: "absolute",
  },
});
