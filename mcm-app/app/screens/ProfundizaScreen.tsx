import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Platform, Text } from 'react-native';
import { PressableFeedback, Skeleton } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FormattedContent from '@/components/FormattedContent';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import PageContainer from '@/components/ui/PageContainer';
import ScreenHero from '@/components/ui/ScreenHero';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';

interface Pagina {
  titulo: string;
  subtitulo?: string;
  texto?: string;
  color?: string;
}

export default function ProfundizaScreen() {
  const scheme = useColorScheme();
  const fontScale = useFontScale(1.2);
  const styles = React.useMemo(
    () => createStyles(scheme, fontScale),
    [scheme, fontScale],
  );
  const event = useCurrentEvent();
  const { data: profundizaData } = useFirebaseData<any>(
    getEventFirebasePath(event, 'profundiza'),
    getEventCacheKey(event, 'profundiza'),
  );
  const data = profundizaData as {
    titulo: string;
    introduccion: string;
    paginas: Pagina[];
  };

  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!data) {
    return (
      <PageContainer>
        <ScrollView
          style={{ flex: 1, backgroundColor: Colors[scheme ?? 'light'].background }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
        >
          <ScreenHero title="Profundiza" />
          <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} style={{ height: 56, borderRadius: radii.xl }} />
            ))}
          </View>
        </ScrollView>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <ScreenHero title={data.titulo} />
        <View style={styles.body}>
          <FormattedContent text={data.introduccion} scale={fontScale} />
          <View style={{ marginTop: 16 }}>
            {data.paginas.map((p, idx) => (
              <View key={idx} style={styles.accordionWrapper}>
                <PressableFeedback
                  onPress={() => setOpenIdx(openIdx === idx ? null : idx)}
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
                    name={openIdx === idx ? 'expand-less' : 'expand-more'}
                    size={24}
                    color={colors.white}
                  />
                </PressableFeedback>
                {openIdx === idx && (
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
            ))}
          </View>
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
