import { StyleSheet, Text, type TextProps } from 'react-native';
import typography from '@/constants/typography'; // Import typography
import { Colors } from '@/constants/colors'; // Import Colors for link

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const linkColor = useThemeColor({}, 'tint'); // Use theme's tint color for links

  let textStyle;
  switch (type) {
    case 'default':
      textStyle = styles.default;
      break;
    case 'title':
      textStyle = styles.title;
      break;
    case 'defaultSemiBold':
      textStyle = styles.defaultSemiBold;
      break;
    case 'subtitle':
      textStyle = styles.subtitle;
      break;
    case 'link':
      // Apply link-specific color directly here, overriding the general 'text' color
      textStyle = [styles.link, { color: linkColor }]; 
      break;
    default:
      textStyle = styles.default;
  }

  return (
    <Text
      style={[
        type !== 'link' && { color }, // Apply general text color if not a link
        textStyle,
        style, // Allow custom styles to override
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    ...typography.body, // Use typography.body
    lineHeight: 24, // Keep existing lineHeight or adjust as needed
  },
  defaultSemiBold: {
    ...typography.body, // Use typography.body
    fontWeight: '600', // Keep existing fontWeight
    lineHeight: 24, // Keep existing lineHeight
  },
  title: {
    ...typography.h1, // Use typography.h1
    // Potentially adjust lineHeight if needed, e.g., typography.h1.fontSize * 1.2
    lineHeight: (typography.h1.fontSize ?? 28) * 1.2, 
  },
  subtitle: {
    ...typography.h2, // Use typography.h2
    // Potentially adjust lineHeight
    lineHeight: (typography.h2.fontSize ?? 22) * 1.2,
  },
  link: {
    ...typography.body, // Base link style on typography.body
    lineHeight: 30, // Keep existing lineHeight or adjust
    // color will be applied dynamically using useThemeColor('tint')
  },
});
