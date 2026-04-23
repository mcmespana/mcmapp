import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Platform,
  Text,
  TouchableOpacity,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FormattedContent from '@/components/FormattedContent';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import {
  getEventCacheKey,
  getEventFirebasePath,
} from '@/constants/events';

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
  const { data: profundizaData, loading } = useFirebaseData<any>(
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
    return <ProgressWithMessage message="Cargando profundiza..." />;
  }

  if (loading) {
    return <ProgressWithMessage message="Actualizando profundiza..." />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.mainTitle}>{data.titulo}</Text>
      <FormattedContent text={data.introduccion} scale={fontScale} />
      <View style={{ marginTop: 16 }}>
        {data.paginas.map((p, idx) => (
          <View key={idx} style={styles.accordionWrapper}>
            <TouchableOpacity
              onPress={() => setOpenIdx(openIdx === idx ? null : idx)}
              style={[
                styles.accordion,
                { backgroundColor: p.color || colors.primary },
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.accordionTitle}>{p.titulo}</Text>
              <MaterialIcons
                name={openIdx === idx ? 'expand-less' : 'expand-more'}
                size={24}
                color={colors.white}
              />
            </TouchableOpacity>
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
    </ScrollView>
  );
}

const createStyles = (scheme: 'light' | 'dark', scale: number) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 100 : 16 },
    mainTitle: {
      fontSize: 24 * scale,
      fontWeight: 'bold',
      marginBottom: 8,
      color: theme.text,
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
      borderColor: colors.border,
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
