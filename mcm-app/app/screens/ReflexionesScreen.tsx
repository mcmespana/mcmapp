import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import {
  Card,
  Text,
  FAB,
  Portal,
  Modal,
  TextInput,
  Switch,
  Button,
  Chip,
} from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';

interface Grupo {
  nombre: string;
  subtitulo?: string;
}

interface Reflexion {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string;
  grupal: boolean;
  grupo?: string;
  autor?: string;
}

export default function ReflexionesScreen() {
  const scheme = useColorScheme(); // 'light' | 'dark' | null
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);

  const { data: dataRef } = useFirebaseData<Reflexion[]>('jubileo/compartiendo', 'jubileo_compartiendo');
  const { data: gruposData } = useFirebaseData<Record<string, Grupo[]>>('jubileo/grupos', 'jubileo_grupos');

  const grupos = gruposData?.['Conso+'] ?? [];

  const [list, setList] = useState<Reflexion[]>(dataRef || []);

  useEffect(() => {
    if (dataRef) {
      setList(dataRef);
    }
  }, [dataRef]);

  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [fecha, setFecha] = useState(new Date());
  const [grupal, setGrupal] = useState(false);
  const [grupo, setGrupo] = useState<string | undefined>();
  const [autor, setAutor] = useState('');
  const [showDate, setShowDate] = useState(false);

  const showDatePicker = () => {
    if (Platform.OS === 'android') {
      const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker');
      DateTimePickerAndroid.open({
        value: fecha,
        mode: 'date',
        onChange: (_event: DateTimePickerEvent, selected?: Date) => {
          if (selected) setFecha(selected);
        },
      });
    } else {
      setShowDate(true);
    }
  };

  const formatFecha = (f: string | Date) => {
    const d = typeof f === 'string' ? new Date(f) : f;
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const addReflexion = async () => {
    if (!titulo.trim() || !contenido.trim()) return;

    const nuevo: Reflexion = {
      id: Date.now().toString(),
      titulo,
      contenido,
      fecha: fecha.toISOString().slice(0, 10),
      grupal,
      ...(grupal && grupo ? { grupo } : {}),
      ...(!grupal && autor ? { autor } : {}),
    };

    try {
      const db = getDatabase(getFirebaseApp());
      const newRef = push(ref(db, 'jubileo/compartiendo/data'));
      await set(newRef, nuevo);
      await set(ref(db, 'jubileo/compartiendo/updatedAt'), Date.now().toString());
      setList(prev => [nuevo, ...prev]);
    } catch (e) {
      console.error('Error adding reflection', e);
    }

    // reset form
    setShowForm(false);
    setTitulo('');
    setContenido('');
    setFecha(new Date());
    setGrupal(false);
    setGrupo(undefined);
    setAutor('');
  };

  const getGrupoLabel = (nombre?: string) => {
    if (!nombre) return '';
    const g = grupos.find(gr => gr.nombre === nombre);
    return g ? (g.subtitulo ? `${g.nombre} - ${g.subtitulo}` : g.nombre) : nombre;
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        {list.length > 0 ? (
          list
            .slice() // clone to avoid mutating state
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
            .map(r => (
              <Card key={r.id} style={[styles.card, r.grupal && styles.cardGroup]}>
                <Card.Title
                  title={r.titulo}
                  subtitle={`${formatFecha(r.fecha)} - ${r.grupal ? getGrupoLabel(r.grupo) : r.autor ?? ''}`}
                />
                <Card.Content>
                  <Text>{r.contenido}</Text>
                </Card.Content>
              </Card>
            ))
        ) : (
          <Text style={styles.noData}>No hay reflexiones disponibles</Text>
        )}
      </ScrollView>

      <FAB icon="plus" style={styles.fab} onPress={() => setShowForm(true)} />

      <Portal>
        <Modal visible={showForm} onDismiss={() => setShowForm(false)} contentContainerStyle={styles.modal}>
          <ScrollView>
            <Button mode="contained" onPress={addReflexion} style={styles.saveBtn}>
              Guardar
            </Button>

            <TextInput
              label="Título"
              value={titulo}
              onChangeText={setTitulo}
              style={styles.input}
            />

            <TextInput
              label="Compartiendo..."
              value={contenido}
              onChangeText={setContenido}
              multiline
              numberOfLines={4}
              style={[styles.input, { minHeight: 100 }]}
            />

            <TouchableOpacity onPress={showDatePicker}>
              <TextInput
                label="Fecha"
                value={formatFecha(fecha)}
                editable={false}
                pointerEvents="none"
                style={styles.input}
              />
            </TouchableOpacity>

            {showDate && (
              <DateTimePicker
                value={fecha}
                mode="date"
                onChange={(_, selected) => {
                  setShowDate(false);
                  if (selected) setFecha(selected);
                }}
              />
            )}

            <View style={styles.row}>
              <Switch value={grupal} onValueChange={() => setGrupal(prev => !prev)} />
              <Text style={styles.switchLabel}>Compartiendo en grupo</Text>
            </View>

            {grupal ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {grupos.map(g => (
                  <Chip
                    key={g.nombre}
                    selected={grupo === g.nombre}
                    onPress={() => setGrupo(g.nombre)}
                    style={styles.chip}
                  >
                    {getGrupoLabel(g.nombre)}
                  </Chip>
                ))}
              </ScrollView>
            ) : (
              <TextInput
                label="Tu nombre (opcional)"
                value={autor}
                onChangeText={setAutor}
                style={styles.input}
              />
            )}
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = Colors[scheme ?? 'light'];

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    list: {
      padding: spacing.md,
    },
    card: {
      marginBottom: spacing.md,
    },
    cardGroup: {
      backgroundColor: '#E6F4D7',
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      backgroundColor: colors.success,
    },
    modal: {
      backgroundColor: theme.background,
      margin: 20,
      padding: 20,
      borderRadius: 8,
    },
    input: {
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    switchLabel: {
      marginLeft: spacing.sm,
      color: theme.text,
    },
    chip: {
      marginRight: spacing.sm,
    },
    saveBtn: {
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    noData: {
      textAlign: 'center',
      marginTop: spacing.lg,
      color: theme.text,
    },
  });
};

export type { Grupo, Reflexion };