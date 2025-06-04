import React, { useEffect, ComponentProps } from 'react';
import { View, Text, StyleSheet, Dimensions, ViewStyle, TextStyle } from 'react-native';
import { Link, LinkProps } from 'expo-router';
import { Card } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, withTiming, withDelay, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { HelloWave } from '@/components/HelloWave';

import colors from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';

type NavigationItem = {
  href?: LinkProps['href'];
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  backgroundColor: string;
  color: string;
  size?: 'default' | 'tall' | 'wide' | 'large';
};

const navigationItems: NavigationItem[] = [
  {
    href: "/cancionero",
    label: "Cantoral",
    icon: "library-music",
    backgroundColor: colors.warning,
    color: colors.black,
    size: 'tall',
  },
  {
    href: "/fotos",
    label: "Fotos",
    icon: "photo-library",
    backgroundColor: colors.accent,
    color: colors.black,
    size: 'wide',
  },
  {
    href: "/calendario",
    label: "Calendario",
    icon: "event",
    backgroundColor: colors.info,
    color: colors.black,
  },
  {
    href: "/comunica",
    label: "Comunica",
    icon: "chat",
    backgroundColor: colors.success,
    color: colors.black,
  },
  {
    label: "Próximamente 1",
    icon: "build",
    backgroundColor: colors.warning,
    color: colors.black,
    size: 'large',
  },
  {
    label: "Próximamente 2",
    icon: "hourglass-empty",
    backgroundColor: colors.danger,
    color: colors.black,
  },
];

const { width } = Dimensions.get('window');
const gap = spacing.lg;
const itemPerRow = 2; // Two columns layout
const totalGapSize = (itemPerRow - 1) * gap;
const windowWidth = width - spacing.lg * 2;
const baseRectSize = (windowWidth - totalGapSize) / itemPerRow;

function AnimatedCard({ children, index }: { children: React.ReactNode; index: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(index * 100, withTiming(1, { duration: 500 }));
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: progress.value }],
    opacity: progress.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={[colors.primary, colors.secondary]}
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
        },
      ]}
    >
      <View style={styles.header}>
        <HelloWave />
      </View>
      <View style={styles.gridContainer}>
        {navigationItems.map((item, index) => {
          const dynamicSizeStyle: ViewStyle = {
            width: baseRectSize,
            height: baseRectSize,
          };
          if (item.size === 'wide' || item.size === 'large') {
            dynamicSizeStyle.width = baseRectSize * 2 + gap;
          }
          if (item.size === 'tall' || item.size === 'large') {
            dynamicSizeStyle.height = baseRectSize * 2 + gap;
          }

          const card = (
            <Card
              key={index}
              style={[
                styles.rectangle,
                dynamicSizeStyle,
                { backgroundColor: item.backgroundColor },
                !item.href && styles.disabledRectangle,
                !item.href && styles.placeholder,
              ]}
              contentStyle={styles.cardContent}
              elevation={2}
            >
              <Card.Content style={styles.cardContent}>
                <View style={styles.circleDecoration} />
                <MaterialIcons name={item.icon} style={styles.icon} size={48} color={item.color} />
                <Text style={[styles.rectangleLabel, { color: item.color }]}>{item.label}</Text>
              </Card.Content>
            </Card>
          );

          const wrapped = <AnimatedCard index={index}>{card}</AnimatedCard>;

          if (item.href) {
            return (
              <Link
                key={typeof item.href === 'string' ? item.href : item.href?.pathname || index}
                href={item.href}
                asChild
              >
                <View style={styles.linkWrapper}>{wrapped}</View>
              </Link>
            );
          }

          return wrapped;
        })}
      </View>
    </LinearGradient>
  );
}

interface Styles {
  container: ViewStyle;
  header: ViewStyle;
  gridContainer: ViewStyle;
  rectangle: ViewStyle;
  cardContent: ViewStyle;
  linkWrapper: ViewStyle;
  disabledRectangle: ViewStyle;
  placeholder: ViewStyle;
  icon: TextStyle;
  circleDecoration: ViewStyle;
  rectangleLabel: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: gap,
  },
  rectangle: {
    width: baseRectSize,
    height: baseRectSize,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  linkWrapper: {
    width: baseRectSize,
    height: baseRectSize,
    outlineStyle: 'solid',
    outlineOffset: 2,
  },
  disabledRectangle: {
    opacity: 0.5,
  },
  placeholder: {
    opacity: 0.6,
    borderStyle: 'dashed',
    borderColor: colors.border || '#bbb',
    borderWidth: 1,
  },
  circleDecoration: {
    position: 'absolute',
    width: baseRectSize * 0.6,
    height: baseRectSize * 0.6,
    borderRadius: baseRectSize * 0.3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    top: -baseRectSize * 0.2,
    right: -baseRectSize * 0.2,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.sm,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.08)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 2,
  },
  rectangleLabel: {
    ...(typography.button as TextStyle),
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 18,
    letterSpacing: 0.5,
    marginTop: 2,
  },
});
