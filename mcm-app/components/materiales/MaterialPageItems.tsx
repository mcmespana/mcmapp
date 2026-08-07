/**
 * Páginas del pager de materiales de evento, extraídas de
 * `app/screens/MaterialPagesScreen.tsx`.
 *
 * Estaban definidas DENTRO del componente de la pantalla, así que cada render
 * del padre creaba un TIPO de componente nuevo y React desmontaba y remontaba
 * cada página visible en vez de actualizarla: el `ScrollView` de cada página
 * perdía su posición de scroll, `FormattedContent` (BBCode→HTML) se reconstruía
 * de cero y los círculos decorativos se re-aleatorizaban (su `useMemo` moría con
 * el remontaje). Es identidad estructural: ninguna memoización lo arregla, hay
 * que sacar el componente del render. Todo lo que antes venía del closure
 * (`styles`, `width`, `height`, `fecha`, `fontScale`, el color del header) es
 * ahora una prop explícita.
 *
 * `createStyles` vive aquí porque las páginas son sus consumidoras principales, y
 * así el tipo `MaterialStyles` no obliga a exportar nada desde la pantalla.
 */
import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Platform,
  DimensionValue,
  ViewStyle,
  type ColorSchemeName,
} from 'react-native';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import FormattedContent from '@/components/FormattedContent';

export interface Pagina {
  titulo?: string;
  subtitulo?: string;
  texto?: string;
}

export interface Actividad {
  id: string;
  nombre: string;
  emoji: string;
  color: string;
  paginas: Pagina[];
}

const generateRandomCircles = (count: number = 5) => {
  const circles = [];
  const SIZES = [50, 100, 150, 80, 120, 60, 200, 400]; // Variety of sizes

  for (let i = 0; i < count; i++) {
    const size = SIZES[i % SIZES.length];
    const opacity = Math.random() * (0.15 - 0.05) + 0.05; // Random opacity between 0.05 and 0.15
    const top = `${Math.random() * 120 - 10}%`; // Random top between -10% and 110%
    const left = `${Math.random() * 120 - 10}%`; // Random left between -10% and 110%
    circles.push({
      size,
      opacity,
      top,
      left,
      color: '#FFF',
    });
  }
  return circles;
};

export type MaterialStyles = ReturnType<typeof createStyles>;

/**
 * `IntroPageItem` y `ContentPageItem` viven a nivel de módulo a propósito.
 *
 * Estaban definidos DENTRO de `MaterialPagesScreen`, así que cada render del
 * padre creaba un TIPO de componente nuevo y React desmontaba y remontaba cada
 * página visible en vez de actualizarla: el `ScrollView` de cada página perdía
 * su posición de scroll, `FormattedContent` se reconstruía de cero y los
 * círculos decorativos se re-aleatorizaban (su `useMemo` moría con el
 * remontaje). Es identidad estructural: ninguna memoización lo arregla, hay que
 * sacar el componente del render. Todo lo que antes venía del closure
 * (`styles`, `width`, `height`, `fecha`, `fontScale`) es ahora una prop.
 */
export const IntroPageItem = ({
  actividad,
  styles,
  width,
  fecha,
}: {
  actividad: Actividad;
  styles: MaterialStyles;
  width: number;
  fecha: string;
}) => {
  // Ahora que el tipo es estable, este memo sobrevive entre renders — que es
  // justo lo que pretendía.
  const circlesData = React.useMemo(() => generateRandomCircles(5), []);
  return (
    <View style={[styles.introPage, { width }]}>
      {circlesData.map((circle, idx) => (
        <View
          key={`deco-${idx}`}
          style={
            {
              position: 'absolute',
              width: circle.size,
              height: circle.size,
              borderRadius: circle.size / 2,
              backgroundColor: circle.color,
              opacity: circle.opacity,
              top: circle.top as DimensionValue,
              left: circle.left as DimensionValue,
            } as ViewStyle
          }
        />
      ))}
      <Text style={styles.introEmoji} selectable>
        {actividad.emoji}
      </Text>
      <Text style={styles.introTitle} selectable>
        {actividad.nombre.toUpperCase()}
      </Text>
      <Text style={styles.introDate} selectable>
        {new Date(fecha)
          .toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })
          .replace(',', '')
          .toUpperCase()}
      </Text>
      <Text style={styles.introHint} selectable>
        Desliza para ver el material
      </Text>
    </View>
  );
};

export const ContentPageItem = ({
  item,
  styles,
  fontScale,
  width,
  height,
  headerColor,
}: {
  item: Pagina;
  styles: MaterialStyles;
  fontScale: number;
  width: number;
  height: number;
  headerColor: string;
}) => {
  const content = item.texto ? (
    <FormattedContent text={item.texto} scale={fontScale} />
  ) : null;

  if (Platform.OS === 'web') {
    // Calculate the remaining height after header, dots, and tab bar
    const headerHeight = 80; // Approximate header height
    const dotsHeight = 60; // Approximate dots container height
    const tabBarHeight = 80; // Approximate tab bar height at bottom
    const contentHeight = height - headerHeight - dotsHeight - tabBarHeight;

    return (
      <View style={[styles.page, { width, height }]}>
        <View style={[styles.pageHeader, { backgroundColor: headerColor }]}>
          <Text style={styles.pageTitle} selectable>
            {item.titulo}
          </Text>
          {item.subtitulo && (
            <Text style={styles.pageSubtitle} selectable>
              {item.subtitulo}
            </Text>
          )}
        </View>
        <div
          style={{
            height: contentHeight,
            overflowY: 'auto',
            padding: spacing.lg,
            boxSizing: 'border-box',
            marginBottom: dotsHeight, // Add margin to avoid overlap with dots
          }}
        >
          {content}
        </div>
      </View>
    );
  }

  return (
    <View style={[styles.page, { width }]}>
      <View style={[styles.pageHeader, { backgroundColor: headerColor }]}>
        <Text style={styles.pageTitle} selectable>
          {item.titulo}
        </Text>
        {item.subtitulo && (
          <Text style={styles.pageSubtitle} selectable>
            {item.subtitulo}
          </Text>
        )}
      </View>
      <ScrollView
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        overScrollMode={'auto'}
        style={{ flex: 1 }}
        scrollEnabled={true}
      >
        {content}
      </ScrollView>
    </View>
  );
};

export const createStyles = (
  scheme: ColorSchemeName,
  introColor: string,
  scale: number,
) => {
  const theme = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return StyleSheet.create({
    container: { flex: 1 },
    introPage: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
      backgroundColor: introColor,
    },
    introEmoji: {
      fontSize: 64 * scale,
      marginBottom: spacing.lg,
    },
    introTitle: {
      fontSize: 22 * scale,
      textAlign: 'center',
      fontWeight: 'bold',
      color: colors.white,
    },
    introDate: {
      fontSize: 14 * scale,
      color: colors.white,
      marginTop: 4,
    },
    introHint: {
      marginTop: spacing.md,
      color: colors.white,
      fontSize: 10 * scale,
    },
    page: {
      flex: 1,
    },
    pageHeader: {
      padding: spacing.md,
    },
    pageTitle: {
      fontSize: 20, // Remove scale multiplication
      fontWeight: 'bold',
      color: colors.white,
    },
    pageSubtitle: {
      fontSize: 16, // Remove scale multiplication
      color: colors.white,
      marginTop: 4,
    },
    pageContent: {
      padding: spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? 120 : spacing.lg,
      flexGrow: 1,
      minHeight: '100%',
    },
    pageText: {
      color: theme.text,
      fontSize: 16 * scale,
    },
    dotsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      padding: spacing.md,
      paddingBottom: Platform.OS === 'ios' ? 100 : spacing.md,
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: scheme === 'dark' ? '#555' : '#ccc',
    },
    dotActive: {
      backgroundColor: colors.accent,
    },
    arrowButton: {
      position: 'absolute',
      top: '50%',
      transform: [{ translateY: -25 }], // Adjust based on arrow size
      backgroundColor: 'rgba(0,0,0,0.4)',
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 30,
      zIndex: 1,
    },
    leftArrow: {
      left: 20,
    },
    rightArrow: {
      right: 20,
    },
    arrowText: {
      color: colors.white,
      fontSize: 28 * scale,
      fontWeight: 'bold',
      lineHeight: 28,
    },
  });
};
