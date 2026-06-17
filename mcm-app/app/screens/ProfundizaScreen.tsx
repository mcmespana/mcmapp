import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Platform, Text } from 'react-native';
import { PressableFeedback, Skeleton } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { h } from '@/utils/haptics';
import FormattedContent from '@/components/FormattedContent';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import { radii } from '@/constants/uiStyles';
import PageContainer from '@/components/ui/PageContainer';
import ScreenHero from '@/components/ui/ScreenHero';
import ComingSoon from '@/components/ui/ComingSoon';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';

interface Pagina {
  titulo: string;
  subtitulo?: string;
  texto?: string;
  color?: string;
}

interface Seccion {
  titulo?: string;
  introduccion?: string;
  paginas?: Pagina[];
}

// Firebase puede devolver un objeto único o un array de secciones
type ProfundizaData = Seccion | Seccion[];

function normalizeSecciones(raw: ProfundizaData | null): Seccion[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return [raw];
}

function AccordionSection({
  seccion,
  styles,
  fontScale,
  globalOpenIdx,
  baseIdx,
  onToggle,
}: {
  seccion: Seccion;
  styles: ReturnType<typeof createStyles>;
  fontScale: number;
  globalOpenIdx: number | null;
  baseIdx: number;
  onToggle: (idx: number) => void;
}) {
  const paginas = Array.isArray(seccion.paginas) ? seccion.paginas : [];
  return (
    <View style={{ marginBottom: 24 }}>
      {seccion.titulo ? (
        <Text style={styles.seccionTitulo}>{seccion.titulo}</Text>
      ) : null}
      {seccion.introduccion ? (
        <View style={{ marginBottom: 12 }}>
          <FormattedContent text={seccion.introduccion} scale={fontScale} />
        </View>
      ) : null}
      {paginas.map((p, i) => {
        const idx = baseIdx + i;
        const open = globalOpenIdx === idx;
        return (
          <View key={idx} style={styles.accordionWrapper}>
            <PressableFeedback
              onPress={() => {
                h.toggle();
                onToggle(idx);
              }}
              style={[
                styles.accordion,
                { backgroundColor: p.color || colors.primary },
              ]}
              accessibilityRole="button"
              accessibilityLabel={p.titulo}
            >
              <PressableFeedback.Highlight />
              <Text style={styles.accordionTitle}>{p.titulo}</Text>
              <MaterialIcons
                name={open ? 'expand-less' : 'expand-more'}
                size={24}
                color={colors.white}
              />
            </PressableFeedback>
            {open && (
              <View style={styles.accordionContent}>
                {p.subtitulo && (
                  <Text style={styles.subtitulo}>{p.subtitulo}</Text>
                )}
                {p.texto && (
                  <FormattedContent text={p.texto} scale={fontScale} />
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function ProfundizaScreen() {
  const scheme = useColorScheme();
  const fontScale = useFontScale(1.2);
  const styles = React.useMemo(
    () => createStyles(scheme, fontScale),
    [scheme, fontScale],
  );
  const event = useCurrentEvent();
  const { data: profundizaData, loading } = useFirebaseData<ProfundizaData>(
    getEventFirebasePath(event, 'profundiza'),
    getEventCacheKey(event, 'profundiza'),
  );

  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const secciones = normalizeSecciones(profundizaData ?? null);
  const hasContent = secciones.some(
    (s) => s.introduccion || (Array.isArray(s.paginas) && s.paginas.length > 0),
  );

  if (!hasContent) {
    if (loading && !profundizaData) {
      return (
        <PageContainer>
          <ScrollView
            style={{
              flex: 1,
              backgroundColor: Colors[scheme ?? 'light'].background,
            }}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          >
            <ScreenHero title="Profundiza" hideOnWeb />
            <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  style={{ height: 56, borderRadius: radii.xl }}
                />
              ))}
            </View>
          </ScrollView>
        </PageContainer>
      );
    }
    return (
      <PageContainer>
        <View
          style={{
            flex: 1,
            backgroundColor: Colors[scheme ?? 'light'].background,
          }}
        >
          <ScreenHero title="Profundiza" hideOnWeb />
          <ComingSoon accentColor={event.tintColor} />
        </View>
      </PageContainer>
    );
  }

  // Calcular el índice base de cada sección para que el acordeón global funcione
  const baseIdxes: number[] = [];
  let acc = 0;
  for (const s of secciones) {
    baseIdxes.push(acc);
    acc += Array.isArray(s.paginas) ? s.paginas.length : 0;
  }

  // Título del hero: primera sección con título, o genérico
  const heroTitle =
    secciones.length === 1 && secciones[0].titulo
      ? secciones[0].titulo
      : 'Profundiza';

  return (
    <PageContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <ScreenHero title={heroTitle} hideOnWeb />
        <View style={styles.body}>
          {secciones.map((s, si) => (
            <AccordionSection
              key={si}
              seccion={s}
              styles={styles}
              fontScale={fontScale}
              globalOpenIdx={openIdx}
              baseIdx={baseIdxes[si]}
              onToggle={(idx) => setOpenIdx(openIdx === idx ? null : idx)}
            />
          ))}
        </View>
      </ScrollView>
    </PageContainer>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null, scale: number) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: {
      paddingTop: 8,
      paddingBottom: Platform.OS === 'ios' ? 100 : 16,
    },
    body: { paddingHorizontal: 20, paddingTop: 8 },
    seccionTitulo: {
      fontWeight: 'bold',
      fontSize: 18 * scale,
      color: theme.text,
      marginBottom: 8,
    },
    accordionWrapper: { marginBottom: 12 },
    accordion: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    accordionTitle: { color: colors.white, fontWeight: 'bold', flex: 1 },
    accordionContent: {
      borderWidth: 1,
      borderColor: scheme === 'dark' ? '#555' : colors.border,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      padding: 12,
      marginTop: -8,
      paddingTop: 16,
    },
    subtitulo: {
      fontWeight: 'bold',
      marginBottom: 8,
      color: theme.text,
      fontSize: 14 * scale,
    },
  });
};
