import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Image, Platform, Text, TouchableOpacity } from 'react-native';
import { Card, Button, Chip, Dialog } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
          <TouchableOpacity key={idx} activeOpacity={0.7} onPress={() => setSelected(v)}>
            <Card style={styles.card}>
              {v.imagen && (
                <Image
                  source={{ uri: v.imagen }}
                  style={styles.image}
                  resizeMode="cover"
                />
              )}
              <Card.Body style={styles.cardContent}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{v.titulo}</Text>
                  {v.subtitulo && (
                    <Text style={styles.subtitle}>{v.subtitulo}</Text>
                  )}
                  {v.fecha && (
                    <View style={styles.dateRow}>
                      <MaterialIcons name="calendar-today" size={18} color="#888" />
                      <Chip size="sm" variant="soft" color="default" style={{ marginLeft: 4 }}>
                        <Chip.Label>{formatDate(v.fecha)}</Chip.Label>
                      </Chip>
                    </View>
                  )}
                </View>
                {v.mapa && (
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    onPress={() => openMap(v.mapa)}
                  >
                    <MaterialIcons name="map" size={24} color="#888" />
                  </Button>
                )}
              </Card.Body>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Dialog
        isOpen={!!selected}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Close />
            {selected && (
              <View style={{ gap: 8 }}>
                <Dialog.Title>{selected.titulo}</Dialog.Title>
                {selected.texto && (
                  <Dialog.Description>{selected.texto}</Dialog.Description>
                )}
                {selected.mapa && (
                  <Button
                    variant="secondary"
                    onPress={() => { openMap(selected.mapa); setSelected(null); }}
                  >
                    <MaterialIcons name="map" size={18} color="#fff" />
                    <Button.Label>Ver en mapa</Button.Label>
                  </Button>
                )}
              </View>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark') => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    list: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 100 : 16 },
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
  });
};
