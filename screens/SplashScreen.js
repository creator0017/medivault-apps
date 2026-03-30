import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function SplashScreen({ navigation }) {
  const pathProgress = useSharedValue(300);
  const fadeOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. Start drawing the heartbeat line (Concept 1)
    pathProgress.value = withTiming(0, { 
      duration: 2000, 
      easing: Easing.bezier(0.42, 0, 0.58, 1) 
    });

    // 2. Fade in the text and branding after 1 second
    fadeOpacity.value = withDelay(1000, withTiming(1, { duration: 1000 }));

    // 3. Move to Onboarding Screen after 4 seconds
    const timer = setTimeout(() => {
      navigation.replace('Onboarding'); 
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: pathProgress.value,
  }));

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* The Animated Logo Box */}
      <View style={styles.logoBox}>
        <Svg viewBox="0 0 100 100" width="100" height="100">
          {/* Medical Grid background */}
          <Path d="M10,80 L90,80 M10,60 L90,60 M10,40 L90,40 M10,20 L90,20" stroke="#EBF4FA" strokeWidth="1"/>
          <Path d="M20,10 L20,90 M40,10 L40,90 M60,10 L60,90 M80,10 L80,90" stroke="#EBF4FA" strokeWidth="1"/>
          
          {/* The Pulse Line Animation */}
          <AnimatedPath 
            d="M10,50 L25,50 L35,20 L45,80 L55,50 L70,30 L85,15" 
            fill="none" 
            stroke="#2E75B6" 
            strokeWidth="6" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeDasharray="300" 
            animatedProps={animatedPathProps} 
          />
          
          {/* Trend Dot */}
          <Circle cx="85" cy="15" r="5" fill="#FF6B6B" />
        </Svg>
      </View>

      {/* Branding - Fades in */}
      <Animated.View style={[styles.textGroup, fadeStyle]}>
        <Text style={styles.title}>MediVault</Text>
        <Text style={styles.subtitle}>Your Health, Securely Managed</Text>
      </Animated.View>

      {/* AI Badge - Fades in */}
      <Animated.View style={[styles.badge, fadeStyle]}>
        <Text style={styles.badgeText}>Powered by AI ✨</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  logoBox: { 
    width: 130, 
    height: 130, 
    backgroundColor: '#F0F7FF', 
    borderRadius: 30, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 20 
  },
  textGroup: { 
    alignItems: 'center' 
  },
  title: { 
    fontSize: 32, 
    fontWeight: '900', 
    color: '#1a365d' 
  },
  subtitle: { 
    fontSize: 14, 
    color: '#64748b', 
    marginTop: 4 
  },
  badge: { 
    marginTop: 50, 
    backgroundColor: '#F8FAFC', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#E2E8F0' 
  },
  badgeText: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#475569' 
  }
});