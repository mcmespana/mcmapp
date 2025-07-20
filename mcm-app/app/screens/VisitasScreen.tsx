import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Image } from 'react-native';
import { Card, IconButton, Modal, Portal, Text } from 'react-native-paper';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';

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
  if (isNaN(d.getTime())) return fecha; // if string not parseable, return as is
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function VisitasScreen() {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { data: visitas, loading } = useFirebaseData<Visita[]>(
    'jubileo/visitas',
    'jubileo_visitas',
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
          <Card key={idx} style={styles.card} onPress={() => setSelected(v)}>
            {v.imagen && (
              <Image
                source={{ uri: v.imagen }}
                style={styles.image}
                resizeMode="cover"
              />
            )}
            <Card.Content style={styles.cardContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{v.titulo}</Text>
                {v.subtitulo && (
                  <Text style={styles.subtitle}>{v.subtitulo}</Text>
                )}
                {v.fecha && (
                  <View style={styles.dateRow}>
                    <IconButton icon="calendar-today" size={18} />
                    <Text>{formatDate(v.fecha)}</Text>
                  </View>
                )}
              </View>
              {v.mapa && (
                <IconButton
                  icon="map"
                  onPress={() => openMap(v.mapa)}
                  accessibilityLabel="Abrir mapa"
                />
              )}
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
      <Portal>
        <Modal
          visible={!!selected}
          onDismiss={() => setSelected(null)}
          contentContainerStyle={styles.modal}
        >
          {selected && (
            <View>
              <Text style={styles.modalTitle}>{selected.titulo}</Text>
              {selected.texto && (
                <Text style={styles.modalText}>{selected.texto}</Text>
              )}
              {selected.mapa && (
                <View style={{ alignItems: 'flex-end' }}>
                  <IconButton
                    icon="map"
                    onPress={() => openMap(selected.mapa)}
                  />
                </View>
              )}
            </View>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark') => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    list: { padding: 16 },
    card: { marginBottom: 16, backgroundColor: theme.background },
    image: {
      width: '100%',
      height: 160,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      marginBottom: 16, // spacing below image
    },
    cardContent: { flexDirection: 'row', alignItems: 'center' },
    title: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 4,
      color: theme.text,
    },
    subtitle: { fontSize: 14, marginBottom: 4, color: theme.text },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    modal: {
      backgroundColor: theme.background,
      margin: 20,
      padding: 20,
      borderRadius: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
      color: theme.text,
    },
    modalText: { fontSize: 14, marginBottom: 12, color: theme.text },
  });
};
