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
    try {
      const schemeUrl =
        Platform.OS === 'ios' ? app.iosScheme : app.androidScheme;
      if (schemeUrl) {
        const canOpen = await Linking.canOpenURL(schemeUrl);
        if (canOpen) {
          await Linking.openURL(schemeUrl);
          return;
        }
      }
      // Si no puede abrir la app o no está instalada, abre la store
      const storeUrl = Platform.OS === 'ios' ? app.iosLink : app.androidLink;
      if (storeUrl) {
        await Linking.openURL(storeUrl);
      }
    } catch (error) {
      // Si hay cualquier error, intenta abrir la store como fallback
      console.log('Error opening app:', error);
      const storeUrl = Platform.OS === 'ios' ? app.iosLink : app.androidLink;
      if (storeUrl) {
        try {
          await Linking.openURL(storeUrl);
        } catch (storeError) {
          console.log('Error opening store:', storeError);
        }
      }
    }
  };

  if (loading || !appsData) {
    return <ProgressWithMessage message="Cargando aplicaciones..." />;
  }

  const apps = [...appsData].sort((a, b) => a.orden - b.orden);

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Texto de introducción */}
        <View style={styles.introContainer}>
          <Text style={styles.introText}>
            Lista de aplicaciones móviles (algunas necesarias 🌟, otras
            opcionales ℹ️) que necesitaremos durante el Jubileo.
          </Text>
          <Text style={styles.introSubtext}>
            Si tocas el icono de la app te la abrirá directamente ✨
          </Text>
        </View>

        <List.Section>
          {apps.map((app, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => openApp(app)}
              activeOpacity={0.7}
            >
              <View style={styles.listItemContainer}>
                <View style={styles.iconContainer}>
                  <Image source={{ uri: app.icono }} style={styles.icon} />
                </View>
                <View style={styles.contentContainer}>
                  <Text style={styles.title}>{app.nombre}</Text>
                  <Text style={styles.description}>{app.descripcion}</Text>
                </View>
                <View style={styles.rightContainer}>
                  {app.tipo.toLowerCase() === 'necesaria' && (
                    <View style={styles.starBadge}>
                      <View style={styles.starBadgeContainer}>
                        <IconButton
                          icon="star"
                          size={16}
                          iconColor="#FFF"
                          style={styles.starBadgeIcon}
                        />
                      </View>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelected(app);
                    }}
                    style={styles.plusButton}
                  >
                    <IconButton icon="plus" size={24} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
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
                  style={[
                    styles.chip,
                    selected.tipo.toLowerCase() === 'necesaria'
                      ? styles.chipNecesaria
                      : styles.chipOpcional,
                  ]}
                  textStyle={styles.chipText}
                  theme={{
                    colors: {
                      primary: '#FFFFFF', // Color del ícono
                      onSurface: '#FFFFFF', // Color del texto
                    },
                  }}
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
    introContainer: {
      padding: 20,
      paddingBottom: 16,
      backgroundColor: theme.background,
    },
    introText: {
      fontSize: 16,
      color: theme.text,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 8,
      fontWeight: '500',
    },
    introSubtext: {
      fontSize: 14,
      color: theme.text,
      textAlign: 'center',
      opacity: 0.7,
      fontStyle: 'italic',
    },
    listItemContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: scheme === 'dark' ? '#333' : '#f0f0f0',
    },
    iconContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    icon: {
      width: 48,
      height: 48,
      borderRadius: 12,
    },
    contentContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      fontWeight: 'bold',
      color: theme.text,
      fontSize: 16,
      marginBottom: 4,
    },
    description: {
      color: theme.text,
      opacity: 0.7,
      fontSize: 14,
      lineHeight: 18,
    },
    rightContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    starBadge: {
      marginRight: 8,
    },
    starBadgeContainer: {
      backgroundColor: '#F5A623',
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    starBadgeIcon: {
      margin: 0,
      width: 24,
      height: 24,
    },
    starIcon: {
      fontSize: 18,
    },
    plusButton: {
      // El IconButton ya tiene su propio estilo
    },
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
    chipNecesaria: {
      backgroundColor: '#F5A623',
    },
    chipOpcional: {
      backgroundColor: '#4A90E2',
    },
    chipText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
    },
    downloadRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 8,
    },
  });
};
