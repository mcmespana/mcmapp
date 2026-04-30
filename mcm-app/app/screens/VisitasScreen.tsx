import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  Image,
  Platform,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Dialog } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';

interface Visita {
  titulo: string;
  subtitulo?: string;
  fecha?: string;
  imagen?: string;
  texto?: string;
  mapa?: string;
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

function formatDate(fecha?: string) {
  if (!fecha) return '';
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return fecha;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function VisitasScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const event = useCurrentEvent();
  const { data: visitas, loading } = useFirebaseData<Visita[]>(
    getEventFirebasePath(event, 'visitas'),
    getEventCacheKey(event, 'visitas'),
  );
  const [selected, setSelected] = useState<Visita | null>(null);

  const openMap = (url?: string) => {
    if (url) Linking.openURL(url);
  };

  if (!visitas) {
    return <ProgressWithMessage message="Cargando visitas..." />;
  }

  if (loading) {
    return <ProgressWithMessage message="Actualizando visitas..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        {(visitas || []).map((v, idx) => (
          <TouchableOpacity
            key={idx}
            activeOpacity={0.85}
            onPress={() => setSelected(v)}
            style={styles.card}
          >
            {v.imagen ? (
              <Image
                source={{ uri: v.imagen }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.cardContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>
                  {v.titulo}
                </Text>
                {v.subtitulo ? (
                  <Text style={styles.subtitle} numberOfLines={2}>
                    {v.subtitulo}
                  </Text>
                ) : null}
                {v.fecha ? (
                  <View style={styles.dateRow}>
                    <MaterialIcons
                      name="calendar-today"
                      size={14}
                      color={isDark ? '#A0A0A8' : '#7B7B82'}
                    />
                    <Text style={styles.dateText} numberOfLines={1}>
                      {formatDate(v.fecha)}
                    </Text>
                  </View>
                ) : null}
              </View>
              {v.mapa ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    openMap(v.mapa);
                  }}
                  hitSlop={10}
                  style={styles.mapBtn}
                  accessibilityLabel="Abrir en el mapa"
                >
                  <MaterialIcons
                    name="map"
                    size={20}
                    color={isDark ? '#7AB3FF' : '#2563EB'}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Dialog
        isOpen={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Close />
            {selected ? (
              <View style={{ gap: 12 }}>
                <Dialog.Title>{selected.titulo}</Dialog.Title>
                {selected.texto ? (
                  <Dialog.Description>{selected.texto}</Dialog.Description>
                ) : null}
                {selected.mapa ? (
                  <TouchableOpacity
                    style={[
                      styles.dialogMapBtn,
                      { backgroundColor: isDark ? '#1A2744' : '#E8F0FE' },
                    ]}
                    onPress={() => {
                      const url = selected.mapa;
                      setSelected(null);
                      openMap(url);
                    }}
                  >
                    <MaterialIcons
                      name="map"
                      size={18}
                      color={isDark ? '#7AB3FF' : '#2563EB'}
                    />
                    <Text
                      style={[
                        styles.dialogMapBtnText,
                        { color: isDark ? '#7AB3FF' : '#2563EB' },
                      ]}
                    >
                      Ver en mapa
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark') => {
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    list: {
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 100 : 24,
      gap: 14,
    },
    card: {
      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
      borderRadius: 16,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 2px 8px rgba(0,0,0,0.35)'
            : '0 2px 8px rgba(0,0,0,0.08)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.3 : 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
      }),
    },
    image: {
      width: '100%',
      height: 160,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    cardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.2,
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? '#C7C7CC' : '#3A3A3C',
      marginBottom: 8,
      lineHeight: 19,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    dateText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#A0A0A8' : '#7B7B82',
      textTransform: 'capitalize',
    },
    mapBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? '#1A2744' : '#E8F0FE',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dialogMapBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 4,
    },
    dialogMapBtnText: {
      fontSize: 15,
      fontWeight: '600',
    },
  });
};
