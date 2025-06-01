import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Text,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import { Link, LinkProps } from 'expo-router';

type NavigationItem = {
  href?: LinkProps['href'];
  label: string;
  iconPlaceholder: string;
  backgroundColor: string;
  color: string;
};
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';
import { commonShadow } from '@/constants/uiStyles';

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
            if (Platform.OS === 'web') {
              return (
                <Link
                  key={typeof item.href === 'string' ? item.href : item.href.pathname || index}
                  href={item.href}
                >
                  <View style={[styles.rectangle, styles.webRectangle, { backgroundColor: item.backgroundColor }]}>
                    {rectangleContent}
                  </View>
                </Link>
              );
            } else {
              return (
                <Link
                  key={typeof item.href === 'string' ? item.href : item.href.pathname || index}
                  href={item.href}
                  asChild
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.rectangle,
                      { backgroundColor: item.backgroundColor, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    {rectangleContent}
                  </Pressable>
                </Link>
              );
            }
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
  webRectangle: ViewStyle;
  webLink: ViewStyle;
  placeholder: ViewStyle;
  iconPlaceholder: TextStyle;
  rectangleLabel: TextStyle;
  title: TextStyle;
  button: ViewStyle;
  buttonLabel: TextStyle;
}

const { width } = Dimensions.get('window');
const gap = spacing.lg;
const itemPerRow = Platform.OS === 'web' && width > 700 ? 3 : 2;
const totalGapSize = (itemPerRow - 1) * gap;
const windowWidth = width - (spacing.lg * 2);
const rectDimension = (windowWidth - totalGapSize) / itemPerRow;

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
    transitionProperty: Platform.OS === 'web' ? 'box-shadow, transform' : undefined,
    transitionDuration: Platform.OS === 'web' ? '0.2s' : undefined,
  },
  webRectangle: {
    cursor: 'pointer',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  webLink: {
    width: rectDimension,
    height: rectDimension,
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
  title: {
    ...(typography.h1 as TextStyle),
    color: colors.text,
    marginBottom: spacing.lg,
  },
  button: {
    width: '80%',
    paddingVertical: spacing.sm,
  },
  buttonLabel: {
    ...(typography.button as TextStyle),
    color: '#fff',
  },
});

// Web-only hover effect (injects global CSS)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    a[style*="inline-block"]:hover > div {
      box-shadow: 0 4px 24px rgba(0,0,0,0.16) !important;
      transform: translateY(-2px) scale(1.03);
    }
    a[style*="inline-block"]:focus > div {
      outline: 2px solid ${colors.primary || '#007aff'};
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}
