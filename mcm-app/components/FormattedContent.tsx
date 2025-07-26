import React from 'react';
import { useWindowDimensions, Linking } from 'react-native';
import RenderHTML from 'react-native-render-html';
import colors from '@/constants/colors';
import { formatBBCodeToHtml } from '@/utils/formatText';

const tagsStyles = {
  h2: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  ul: { marginVertical: 8, paddingLeft: 20 },
  li: { marginBottom: 4 },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
    paddingLeft: 8,
    marginVertical: 8,
  },
};

const classesStyles = {
  'btn-primary': {
    backgroundColor: colors.primary,
    color: colors.white,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    textAlign: 'center',
    marginVertical: 4,
    display: 'inline-block',
  },
  'btn-secondary': {
    backgroundColor: colors.accent,
    color: colors.white,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    textAlign: 'center',
    marginVertical: 4,
    display: 'inline-block',
  },
  'color-primary': { color: colors.primary },
  'color-accent': { color: colors.accent },
  'color-info': { color: colors.info },
  'color-success': { color: colors.success },
};

export default function FormattedContent({ text }: { text: string }) {
  const html = React.useMemo(() => formatBBCodeToHtml(text), [text]);
  const { width } = useWindowDimensions();
  return (
    <RenderHTML
      contentWidth={width}
      source={{ html }}
      tagsStyles={tagsStyles as any}
      classesStyles={classesStyles as any}
      onLinkPress={(_, href) => Linking.openURL(href)}
    />
  );
}
