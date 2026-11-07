// Items del pager de MaterialPagesScreen, hoisted a módulo-level (antes se
// definían dentro del render de la pantalla): cada render del padre creaba
// un TIPO de componente nuevo, así que React desmontaba y remontaba cada
// página del pager en vez de actualizarla — el ScrollView perdía la
// posición de scroll y los círculos decorativos se re-aleatorizaban en
// cada interacción. Con el tipo estable, el `useMemo` de los círculos
// ahora sí sobrevive entre renders.
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Platform,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import spacing from '@/constants/spacing';
import FormattedContent from '@/components/FormattedContent';
import type {
  Pagina,
  Actividad,
  MaterialPagesStyles,
} from '@/app/screens/MaterialPagesScreen';

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

export function IntroPageItem({
  actividad,
  styles,
  width,
  fecha,
}: {
  actividad: Actividad;
  styles: MaterialPagesStyles;
  width: number;
  fecha: string;
}) {
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
}

export function ContentPageItem({
  item,
  styles,
  fontScale,
  width,
  height,
  color,
}: {
  item: Pagina;
  styles: MaterialPagesStyles;
  fontScale: number;
  width: number;
  height: number;
  color: string;
}) {
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
        <View style={[styles.pageHeader, { backgroundColor: color }]}>
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
      <View style={[styles.pageHeader, { backgroundColor: color }]}>
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
}
