import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import {
  List,
  IconButton,
  Portal,
  Modal,
  Text,
  Chip,
} from 'react-native-paper';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import ProgressWithMessage from '@/components/ProgressWithMessage';

interface AppInfo {
  orden: number;
  nombre: string;
  descripcion: string;
  tipo: string;
  icono: string;
  iosLink: string;
  androidLink: string;
  iosScheme?: string;
  androidScheme?: string;
}

export default function AppsScreen() {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { data: appsData, loading } = useFirebaseData<AppInfo[]>(
    'jubileo/apps',
    'jubileo_apps',
  );
  const [selected, setSelected] = useState<AppInfo | null>(null);

  const openApp = async (app: AppInfo) => {
    const schemeUrl = Platform.OS === 'ios' ? app.iosScheme : app.androidScheme;
    if (schemeUrl) {
      const can = await Linking.canOpenURL(schemeUrl);
      if (can) {
        Linking.openURL(schemeUrl);
        return;
      }
    }
    const storeUrl = Platform.OS === 'ios' ? app.iosLink : app.androidLink;
    if (storeUrl) Linking.openURL(storeUrl);
  };

  if (loading || !appsData) {
    return <ProgressWithMessage message="Cargando aplicaciones..." />;
  }

  const apps = [...appsData].sort((a, b) => a.orden - b.orden);

  return (
    <View style={styles.container}>
      <ScrollView>
        <List.Section>
          {apps.map((app, idx) => (
            <List.Item
              key={idx}
              title={app.nombre}
              description={app.descripcion}
              left={() => (
                <TouchableOpacity onPress={() => openApp(app)}>
                  <Image source={{ uri: app.icono }} style={styles.icon} />
                </TouchableOpacity>
              )}
              right={() => (
                <IconButton icon="plus" onPress={() => setSelected(app)} />
              )}
              titleStyle={styles.title}
            />
          ))}
        </List.Section>
      </ScrollView>
      <Portal>
        <Modal
          visible={!!selected}
          onDismiss={() => setSelected(null)}
          contentContainerStyle={styles.modal}
        >
          {selected && (
            <View>
              <Text style={styles.modalTitle}>{selected.nombre}</Text>
              <Text style={styles.modalDesc}>{selected.descripcion}</Text>
              <View style={styles.chipRow}>
                <Chip
                  icon={
                    selected.tipo.toLowerCase() === 'necesaria'
                      ? 'star'
                      : 'information'
                  }
                  style={styles.chip}
                >
                  {selected.tipo}
                </Chip>
              </View>
              <View style={styles.downloadRow}>
                <IconButton
                  icon="apple"
                  size={28}
                  onPress={() => Linking.openURL(selected.iosLink)}
                />
                <IconButton
                  icon="android"
                  size={28}
                  onPress={() => Linking.openURL(selected.androidLink)}
                />
              </View>
            </View>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    icon: { width: 40, height: 40, borderRadius: 8, marginRight: 8 },
    title: { fontWeight: 'bold', color: theme.text },
    modal: {
      backgroundColor: theme.background,
      padding: 20,
      margin: 20,
      borderRadius: 8,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
      color: theme.text,
    },
    modalDesc: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 12,
      color: theme.text,
    },
    chipRow: { alignItems: 'center', marginBottom: 12 },
    chip: { alignSelf: 'center' },
    downloadRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 8,
    },
  });
};
