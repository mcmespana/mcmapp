import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, ViewStyle, TextStyle, Text } from 'react-native';
import { Link, LinkProps } from 'expo-router';
import { Card } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, withTiming, withDelay, useAnimatedStyle } from 'react-native-reanimated';
import { HelloWave } from '@/components/HelloWave';

import colors from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';

type NavigationItem = {
  href?: LinkProps['href'];
  label: string;
  iconPlaceholder: string;
  backgroundColor: string;
  color: string;
};

const navigationItems: NavigationItem[] = [
  {
    href: "/cancionero",
    label: "Cantoral",
    iconPlaceholder: "🎵",
    backgroundColor: colors.warning,
    color: colors.black,
  },
  {
    href: "/fotos",
    label: "Fotos",
    iconPlaceholder: "📷",
    backgroundColor: colors.accent,
    color: colors.black,
  },
  {
    href: "/calendario",
    label: "Calendario",
    iconPlaceholder: "📅",
    backgroundColor: colors.info,
    color: colors.black,
  },
  {
    href: "/comunica",
    label: "Comunica",
    iconPlaceholder: "💬",
    backgroundColor: colors.success,
    color: colors.black,
  },
  {
    label: "Próximamente 1",
    iconPlaceholder: "🚧",
    backgroundColor: colors.warning,
    color: colors.black,
  },
  {
    label: "Próximamente 2",
    iconPlaceholder: "⏳",
    backgroundColor: colors.danger,
    color: colors.black,
  },
];

const { width } = Dimensions.get('window');
const gap = spacing.lg;
const itemPerRow = width > 700 ? 3 : 2;
const totalGapSize = (itemPerRow - 1) * gap;
const windowWidth = width - (spacing.lg * 2);
const maxRectSize = 180;
const rectDimension = Math.min(
  (windowWidth - totalGapSize) / itemPerRow,
  maxRectSize
);

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
  return (
    <LinearGradient colors={[colors.primary, colors.accent]} style={styles.container}>
      <View style={styles.header}>
        <HelloWave />
      </View>
      <View style={styles.gridContainer}>
        {navigationItems.map((item, index) => {
          const card = (
            <Card
              key={index}
              style={[
                styles.rectangle,
                { backgroundColor: item.backgroundColor },
                !item.href && styles.disabledRectangle,
                !item.href && styles.placeholder,
              ]}
              contentStyle={styles.cardContent}
              elevation={2}
            >
              <Card.Content style={styles.cardContent}>
                <Text style={[styles.iconPlaceholder, { color: item.color }]}>{item.iconPlaceholder}</Text>
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
  iconPlaceholder: TextStyle;
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
    width: rectDimension,
    height: rectDimension,
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
    width: rectDimension,
    height: rectDimension,
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
  iconPlaceholder: {
    fontSize: 48,
    fontWeight: 'bold',
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
