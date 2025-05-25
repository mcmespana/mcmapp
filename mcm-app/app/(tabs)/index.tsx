// app/(tabs)/index.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle, TextStyle, TouchableOpacity, Text, Platform, Dimensions } from 'react-native';
// Removed Button from react-native-paper as it's no longer used directly for navigation buttons
// import { Text, Button } from 'react-native-paper'; 
import { Link } from 'expo-router';
import * as Notifications from 'expo-notifications'; // NOTIS - Se qutia el import
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';
import { commonShadow } from '@/constants/uiStyles'; // Import commonShadow

// Define an array for navigation items to make rendering more DRY
const navigationItems = [
  {
    href: "/cancionero",
    label: "Cantoral",
    iconPlaceholder: "C",
    backgroundColor: colors.primary,
    color: colors.white, // Ensuring text is readable
  },
  {
    href: "/fotos",
    label: "Fotos",
    iconPlaceholder: "F",
    backgroundColor: colors.accent,
    color: colors.white,
  },
  {
    href: "/calendario",
    label: "Calendario",
    iconPlaceholder: "Ca",
    backgroundColor: colors.info,
    color: colors.black, // info color might be light, ensure contrast
  },
  {
    href: "/comunica",
    label: "Comunica",
    iconPlaceholder: "Co",
    backgroundColor: colors.success,
    color: colors.white,
  },
  {
    // No href for placeholder
    label: "Próximamente 1",
    iconPlaceholder: "P1",
    backgroundColor: colors.warning,
    color: colors.black, // Warning color is often light
  },
  {
    // No href for placeholder
    label: "Próximamente 2",
    iconPlaceholder: "?",
    backgroundColor: colors.danger,
    color: colors.white,
  },
];

export default function Home() {

  // NOTIS - Se quita el código de enviar notidficaciones
  // ... (notification code remains commented out)

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
              <Link key={item.href} href={item.href} asChild>
                <TouchableOpacity
                  style={[
                    styles.rectangle,
                    { backgroundColor: item.backgroundColor },
                  ]}
                >
                  {rectangleContent}
                </TouchableOpacity>
              </Link>
            );
          } else {
            // Render a non-navigable View or TouchableOpacity for placeholders
            return (
              <View
                key={`placeholder-${index}`} // Use index for key as href is missing
                style={[
                  styles.rectangle,
                  { backgroundColor: item.backgroundColor },
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
  gridContainer: ViewStyle; // For the 2x2 grid layout
  rectangle: ViewStyle;
  // rectangleWide: ViewStyle; // For varying dimensions example
  // rectangleTall: ViewStyle; // For varying dimensions example
  iconPlaceholder: TextStyle;
  rectangleLabel: TextStyle;
  // Keep existing styles if they are used elsewhere or for overall page theme
  title: TextStyle;
  button: ViewStyle;
  buttonLabel: TextStyle;
}

const { width } = Dimensions.get('window');
const gap = spacing.md;
const itemPerRow = 2;
const totalGapSize = (itemPerRow - 1) * gap;
const windowWidth = width - (spacing.md * 2); // container padding
const rectDimension = (windowWidth - totalGapSize) / itemPerRow;


const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center', // Center the grid container vertically
    alignItems: 'center', // Center the grid container horizontally
    padding: spacing.md,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between', // Distribute items evenly with space around
    // alignItems: 'center', // Align items in the center of their row
    width: '100%', // Take full width of the container
    // maxHeight: rectDimension * 2 + gap, // Approximate height for 2 rows
  },
  rectangle: {
    width: rectDimension,
    height: rectDimension, // Make them square
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: spacing.sm,
    marginBottom: gap, // Gap between rows
    // Shadow properties
    ...commonShadow, // Apply common shadow style
  },
  // rectangleWide: { // Example for varying sizes
  //   width: (windowWidth - gap) / 2 * 1.2, // Wider
  //   height: rectDimension * 0.8, // Shorter
  // },
  // rectangleTall: { // Example for varying sizes
  //   width: (windowWidth - gap) / 2 * 0.8, // Narrower
  //   height: rectDimension * 1.2, // Taller
  // },
  iconPlaceholder: {
    fontSize: 48, // Large icon placeholder
    fontWeight: 'bold',
    marginBottom: spacing.sm,
  },
  rectangleLabel: {
    ...(typography.button as TextStyle), // Use existing button typography for consistency
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Keep existing styles that might be used by other parts of the app or for general theming
  title: {
    ...(typography.h1 as TextStyle),
    color: colors.text,
    marginBottom: spacing.lg,
  },
  button: { // This style was for the old buttons, might not be needed here
    width: '80%',
    paddingVertical: spacing.sm,
  },
  buttonLabel: { // This style was for the old buttons
    ...(typography.button as TextStyle),
    color: '#fff',
  },
});
