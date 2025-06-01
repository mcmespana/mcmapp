import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  Dimensions,
  Pressable,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Link, LinkProps } from 'expo-router';

import colors from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';
import { commonShadow } from '@/constants/uiStyles';

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

export default function Home() {
  return (
    <View style={styles.container}>
      <View style={styles.gridContainer}>
        {navigationItems.map((item, index) => {
          const rectangleContent = (
            <>
              <Text style={[styles.iconPlaceholder, { color: item.color }]}>{item.iconPlaceholder}</Text>
              <Text style={[styles.rectangleLabel, { color: item.color }]}>{item.label}</Text>
            </>
          );

          if (item.href) {
            return (
              <Link
                key={typeof item.href === 'string' ? item.href : item.href?.pathname || index}
                href={item.href}
                asChild
              >
                <Pressable
                  style={({ pressed, hovered }) => [
                    styles.rectangle,
                    { backgroundColor: item.backgroundColor, opacity: pressed ? 0.85 : 1, width: rectDimension, height: rectDimension },
                    hovered && styles.rectangleHover,
                  ]}
                  accessibilityRole="button"
                >
                  {rectangleContent}
                </Pressable>
              </Link>
            );
          } else {
            return (
              <View
                key={`placeholder-${index}`}
                style={[
                  styles.rectangle,
                  styles.placeholder,
                  { backgroundColor: item.backgroundColor, opacity: 0.7 },
                ]}
              >
                {rectangleContent}
              </View>
            );
          }
        })}
      </View>
    </View>
  );
}

interface Styles {
  container: ViewStyle;
  gridContainer: ViewStyle;
  rectangle: ViewStyle;
  rectangleHover: ViewStyle;
  rectangleFocus: ViewStyle;
  placeholder: ViewStyle;
  iconPlaceholder: TextStyle;
  rectangleLabel: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 900,
    gap,
  },
  rectangle: {
    width: rectDimension,
    height: rectDimension,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    margin: gap / 2,
    borderWidth: 1,
    borderColor: colors.border || '#e0e0e0',
    ...commonShadow,
    transitionProperty: 'box-shadow, transform',
    transitionDuration: '0.2s',
  },
  rectangleHover: {
    // Web-only hover effect
    boxShadow: '0 4px 24px rgba(0,0,0,0.16)',
    transform: [{ translateY: -2 }, { scale: 1.03 }],
  },
  rectangleFocus: {
    // Web-only focus effect
    outlineWidth: 2,
    outlineColor: colors.primary || '#007aff',
    outlineStyle: 'solid',
    outlineOffset: 2,
  },
  placeholder: {
    opacity: 0.6,
    borderStyle: 'dashed',
    borderColor: colors.border || '#bbb',
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
