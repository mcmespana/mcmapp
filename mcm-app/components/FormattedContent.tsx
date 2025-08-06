import React from 'react';
import { useWindowDimensions, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import RenderHTML from 'react-native-render-html';
import colors, { Colors } from '@/constants/colors';
import { formatBBCodeToHtml } from '@/utils/formatText';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';

interface FormattedContentProps {
  text: string;
  scale?: number; // Opcional, usa el hook por defecto si no se pasa
}

export default function FormattedContent({
  text,
  scale,
}: FormattedContentProps) {
  const html = React.useMemo(() => formatBBCodeToHtml(text), [text]);
  const { width } = useWindowDimensions();
  const scheme = useColorScheme();
  const defaultScale = useFontScale(1.2);
  const theme = Colors[scheme ?? 'light'];

  // Usar la escala pasada o la del hook por defecto
  const fontScale = scale ?? defaultScale;

  // Estilos que respetan tema y escala
  const dynamicTagsStyles = React.useMemo(
    () => ({
      body: {
        fontSize: 16 * fontScale,
        color: theme.text,
        lineHeight: 24 * fontScale,
      },
      p: {
        fontSize: 16 * fontScale,
        color: theme.text,
        lineHeight: 24 * fontScale,
        marginBottom: 8 * fontScale,
      },
      h1: {
        fontSize: 24 * fontScale,
        fontWeight: 'bold' as const,
        marginBottom: 12 * fontScale,
        color: theme.text,
      },
      h2: {
        fontSize: 22 * fontScale,
        fontWeight: 'bold' as const,
        marginBottom: 8 * fontScale,
        color: theme.text,
      },
      h3: {
        fontSize: 20 * fontScale,
        fontWeight: 'bold' as const,
        marginBottom: 6 * fontScale,
        color: theme.text,
      },
      ul: {
        marginVertical: 8 * fontScale,
        paddingLeft: 20 * fontScale,
      },
      li: {
        marginBottom: 4 * fontScale,
        fontSize: 16 * fontScale,
        color: theme.text,
        lineHeight: 22 * fontScale,
      },
      blockquote: {
        borderLeftWidth: 4,
        borderLeftColor: colors.info,
        paddingLeft: 12 * fontScale,
        paddingRight: 12 * fontScale,
        marginVertical: 12 * fontScale,
        backgroundColor:
          scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        paddingVertical: 8 * fontScale,
        borderRadius: 6,
        // Sombra sutil para el blockquote
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      },
      strong: {
        fontWeight: 'bold' as const,
        color: theme.text,
      },
      em: {
        fontStyle: 'italic' as const,
        color: theme.text,
      },
      a: {
        color: colors.primary,
        textDecorationLine: 'underline' as const,
      },
    }),
    [theme, fontScale, scheme],
  );

  const dynamicClassesStyles = React.useMemo(
    () => ({
      'btn-primary': {
        backgroundColor: colors.primary,
        color: colors.white,
        paddingVertical: 12 * fontScale,
        paddingHorizontal: 20 * fontScale,
        borderRadius: 8,
        textAlign: 'center' as const,
        marginVertical: 8 * fontScale,
        marginHorizontal: 4 * fontScale,
        display: 'inline-block' as const,
        fontSize: 16 * fontScale,
        fontWeight: '600' as const,
        minWidth: 120 * fontScale,
        // Sombra para efecto de botón
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
        // Borde sutil para definir mejor el botón
        borderWidth: 1,
        borderColor: colors.primary,
        // Mejor espaciado interno
        lineHeight: 20 * fontScale,
      },
      'btn-secondary': {
        backgroundColor: colors.accent,
        color: colors.white,
        paddingVertical: 12 * fontScale,
        paddingHorizontal: 20 * fontScale,
        borderRadius: 8,
        textAlign: 'center' as const,
        marginVertical: 8 * fontScale,
        marginHorizontal: 4 * fontScale,
        display: 'inline-block' as const,
        fontSize: 16 * fontScale,
        fontWeight: '600' as const,
        minWidth: 120 * fontScale,
        // Sombra para efecto de botón
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
        // Borde sutil para definir mejor el botón
        borderWidth: 1,
        borderColor: colors.accent,
        // Mejor espaciado interno
        lineHeight: 20 * fontScale,
      },
      'color-primary': { color: colors.primary },
      'color-accent': { color: colors.accent },
      'color-info': { color: colors.info },
      'color-success': { color: colors.success },
      // Estilos adicionales para mejor presentación
      'btn-outline-primary': {
        backgroundColor: 'transparent',
        color: colors.primary,
        paddingVertical: 12 * fontScale,
        paddingHorizontal: 20 * fontScale,
        borderRadius: 8,
        textAlign: 'center' as const,
        marginVertical: 8 * fontScale,
        marginHorizontal: 4 * fontScale,
        display: 'inline-block' as const,
        fontSize: 16 * fontScale,
        fontWeight: '600' as const,
        minWidth: 120 * fontScale,
        borderWidth: 2,
        borderColor: colors.primary,
        lineHeight: 20 * fontScale,
      },
      'btn-outline-secondary': {
        backgroundColor: 'transparent',
        color: colors.accent,
        paddingVertical: 12 * fontScale,
        paddingHorizontal: 20 * fontScale,
        borderRadius: 8,
        textAlign: 'center' as const,
        marginVertical: 8 * fontScale,
        marginHorizontal: 4 * fontScale,
        display: 'inline-block' as const,
        fontSize: 16 * fontScale,
        fontWeight: '600' as const,
        minWidth: 120 * fontScale,
        borderWidth: 2,
        borderColor: colors.accent,
        lineHeight: 20 * fontScale,
      },
      badge: {
        backgroundColor: colors.info,
        color: colors.white,
        paddingVertical: 4 * fontScale,
        paddingHorizontal: 8 * fontScale,
        borderRadius: 12,
        fontSize: 12 * fontScale,
        fontWeight: '600' as const,
        display: 'inline-block' as const,
        marginHorizontal: 2 * fontScale,
      },
      alert: {
        backgroundColor:
          scheme === 'dark' ? 'rgba(255,193,7,0.2)' : 'rgba(255,193,7,0.1)',
        borderLeftWidth: 4,
        borderLeftColor: '#ffc107',
        paddingVertical: 12 * fontScale,
        paddingHorizontal: 16 * fontScale,
        borderRadius: 6,
        marginVertical: 8 * fontScale,
      },
    }),
    [fontScale, scheme],
  );

  return (
    <RenderHTML
      contentWidth={width}
      source={{ html }}
      defaultTextProps={{ selectable: true }}
      tagsStyles={dynamicTagsStyles as any}
      classesStyles={dynamicClassesStyles as any}
      renderers={{
        span: ({ tnode }: { tnode: any }) => {
          const className = tnode.attributes?.class;

          if (className === 'btn-primary') {
            const buttonStyles = {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              borderWidth: 1,
              paddingVertical: 12 * fontScale,
              paddingHorizontal: 20 * fontScale,
              borderRadius: 8,
              marginVertical: 8 * fontScale,
              marginHorizontal: 4 * fontScale,
              minWidth: 120 * fontScale,
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            };

            const textStyles = {
              color: colors.white,
              fontSize: 16 * fontScale,
              fontWeight: '600' as const,
              textAlign: 'center' as const,
              lineHeight: 20 * fontScale,
            };

            return (
              <TouchableOpacity style={buttonStyles} activeOpacity={0.8}>
                <Text style={textStyles}>
                  {tnode.children?.[0]?.data || 'Botón'}
                </Text>
              </TouchableOpacity>
            );
          }

          if (className === 'btn-secondary') {
            const buttonStyles = {
              backgroundColor: colors.accent,
              borderColor: colors.accent,
              borderWidth: 1,
              paddingVertical: 12 * fontScale,
              paddingHorizontal: 20 * fontScale,
              borderRadius: 8,
              marginVertical: 8 * fontScale,
              marginHorizontal: 4 * fontScale,
              minWidth: 120 * fontScale,
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
              shadowColor: colors.accent,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            };

            const textStyles = {
              color: colors.white,
              fontSize: 16 * fontScale,
              fontWeight: '600' as const,
              textAlign: 'center' as const,
              lineHeight: 20 * fontScale,
            };

            return (
              <TouchableOpacity style={buttonStyles} activeOpacity={0.8}>
                <Text style={textStyles}>
                  {tnode.children?.[0]?.data || 'Botón'}
                </Text>
              </TouchableOpacity>
            );
          }

          // Para otros spans, usar el renderizador por defecto
          return undefined;
        },
      }}
    />
  );
}
