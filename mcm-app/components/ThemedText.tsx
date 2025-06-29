import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import typography from '@/constants/typography';
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
      style={
        [type !== 'link' && { color }, textStyle, style].filter(
          Boolean,
        ) as any[]
      }
      {...rest}
    />
  );
}

const getLineHeight = (style: TextStyle, fallback: number): number => {
  const size = style.fontSize ?? fallback;
  return Math.round(size * 1.2);
};

const styles = StyleSheet.create({
  default: {
    ...typography.body,
    lineHeight: 24,
  },
  defaultSemiBold: {
    ...typography.body,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  title: {
    ...typography.h1,
    lineHeight: getLineHeight(typography.h1, 28),
  },
  subtitle: {
    ...typography.h2,
    lineHeight: getLineHeight(typography.h2, 22),
  },
  link: {
    ...typography.body, // Base link style on typography.body
    lineHeight: 30, // Keep existing lineHeight or adjust
    // color will be applied dynamically using useThemeColor('tint')
  },
});
