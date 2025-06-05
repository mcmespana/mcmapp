import React, { useEffect, ComponentProps } from 'react';
import { View, Text, StyleSheet, Dimensions, ViewStyle, TextStyle, ScrollView } from 'react-native';
import { Link, LinkProps } from 'expo-router';
import { Card } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, withTiming, withDelay, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';

type NavigationItem = {
  href?: LinkProps['href'];
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  backgroundColor: string;
  color: string;
};

const navigationItems: NavigationItem[] = [
  {
    href: "/cancionero",
    label: "Cantoral",
    icon: "library-music",
    backgroundColor: colors.warning,
    color: colors.black,
  },
  {
    href: "/fotos",
    label: "Fotos",
    icon: "photo-library",
    backgroundColor: colors.accent,
    color: colors.black,
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
    label: "Mas cosas...",
    icon: "build",
    backgroundColor: colors.warning,
    color: colors.black,
  },
  {
    label: "Y mas cosas....",
    icon: "hourglass-empty",
    backgroundColor: colors.danger,
    color: colors.black,
  },
];

// Global constants that don't depend on component state/props
const GAP_SIZE = spacing.lg;
const ITEMS_PER_ROW = 2;

function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: ViewStyle; /* Removed ...rest and [key: string]: any */ }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(index * 100, withTiming(1, { duration: 500 }));
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: progress.value }],
    opacity: progress.value,
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>; // Removed {...rest}
}

export default function Home() {
  const currentInsets = useSafeAreaInsets();
  const { width: windowWidthDimen, height: windowHeightDimen } = Dimensions.get('window');

  const baseRectSize = React.useMemo(() => {
    const numNavigationItems = navigationItems.length;
    const numberOfRows = Math.ceil(numNavigationItems / ITEMS_PER_ROW);

    // Calculate size based on width
    const horizontalPadding = spacing.lg * 2; // For scrollContentContainer
    const availableWidthForGrid = windowWidthDimen - horizontalPadding;
    const widthBasedSize = (availableWidthForGrid - (ITEMS_PER_ROW - 1) * GAP_SIZE) / ITEMS_PER_ROW;

    // Calculate size based on height
    // Height available for ScrollView's content (after LinearGradient's safe area padding)
    const scrollViewContentAvailableHeight = windowHeightDimen - (currentInsets.top + currentInsets.bottom);
    // Height available for grid items within ScrollView content (after scrollContentContainer's own padding)
    const verticalPaddingForScrollContent = spacing.lg * 2;
    const availableHeightForGridItems = scrollViewContentAvailableHeight - verticalPaddingForScrollContent;
    const heightBasedSize = (availableHeightForGridItems - (numberOfRows - 1) * GAP_SIZE) / numberOfRows;
    
    // Use the smaller of the two, ensuring it's a positive number and has a minimum
    const constrainedSize = Math.min(widthBasedSize, heightBasedSize > 0 ? heightBasedSize : widthBasedSize);
    return Math.max(constrainedSize, 50); // Minimum item size 50x50
  }, [windowWidthDimen, windowHeightDimen, currentInsets]);

  const insets = currentInsets; // Keep using 'insets' variable name if preferred in LinearGradient
  return (
    <LinearGradient
      colors={[colors.primary, colors.secondary]}
      style={[
        styles.outerContainer, // Changed from styles.container
        {
          paddingTop: insets.top, // Only inset for top
          paddingBottom: insets.bottom, // Only inset for bottom
        },
      ]}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <View style={styles.gridContainer}>
        {navigationItems.map((item, index) => {
          const itemKey = `${item.label.replace(/\s+/g, '-')}-${index}`; // Create a more robust key

          const dynamicSizeStyle: ViewStyle = {
            width: baseRectSize,
            height: baseRectSize,
          };

          const dynamicCircleStyle: ViewStyle = {
            width: baseRectSize * 0.6,
            height: baseRectSize * 0.6,
            borderRadius: baseRectSize * 0.3,
            top: -baseRectSize * 0.2,
            right: -baseRectSize * 0.2,
          };

          const card = (
            <Card
              // key prop will be on the wrapping AnimatedCard or Link
              style={[
                styles.rectangle, // Contains static styles like borderRadius
                // dynamicSizeStyle is now applied to AnimatedCard, Card will flex into it.
                { backgroundColor: item.backgroundColor },
                !item.href && styles.disabledRectangle,
                !item.href && styles.placeholder,
              ]}
              contentStyle={styles.cardContentInternal}
              elevation={2}
            >
              <Card.Content style={styles.cardContentInternal}>
                <View style={styles.circleDecoration} /> {/* Reverted: No dynamicCircleStyle */}
                <MaterialIcons name={item.icon} style={styles.icon} size={48} color={item.color} /> {/* Reverted: Fixed icon size */}
                <Text style={[styles.rectangleLabel, { color: item.color }]}>{item.label}</Text> {/* Reverted: Fixed text size */}
              </Card.Content>
            </Card>
          );

          if (item.href) {
            return (
              <Link
                key={itemKey}
                href={item.href}
                asChild
                // style prop removed from Link
              >
                <AnimatedCard index={index} style={dynamicSizeStyle}> {/* Apply style to AnimatedCard directly */}
                  {card} 
                </AnimatedCard>
              </Link>
            );
          }

          // For non-linked items
          return (
            <AnimatedCard key={itemKey} index={index} style={dynamicSizeStyle}>
              {card}
            </AnimatedCard>
          );
        })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

interface Styles {
  outerContainer: ViewStyle; // Renamed from container
  scrollView: ViewStyle;
  scrollContentContainer: ViewStyle;
  gridContainer: ViewStyle;
  rectangle: ViewStyle; // Will now primarily hold non-size related styles
  cardContentInternal: ViewStyle; // Renamed from cardContent to avoid conflict if Card.Content has 'cardContent' prop
  disabledRectangle: ViewStyle;
  placeholder: ViewStyle;
  icon: TextStyle;
  circleDecoration: ViewStyle;
  rectangleLabel: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  outerContainer: { // Renamed from container
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: spacing.lg, // Uniform padding for the content
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: GAP_SIZE, // Use the global constant
  },
  rectangle: {
    // width and height are now dynamic, applied via dynamicSizeStyle
    borderRadius: 16,
    overflow: 'hidden',
    flex: 1, // Ensure Card fills AnimatedCard
  },
  cardContentInternal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    padding: spacing.sm, // Add some internal padding
  },
  // linkWrapper is removed as AnimatedCard handles its own sizing
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
    // width, height, borderRadius, top, right are now dynamic, applied via dynamicCircleStyle
    backgroundColor: 'rgba(255,255,255,0.2)',
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
