import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
  Text,
  Modal,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const schemeUrl =
          Platform.OS === 'ios' ? app.iosScheme : app.androidScheme;
        if (schemeUrl) {
          const canOpen = await Linking.canOpenURL(schemeUrl);
          if (canOpen) {
            await Linking.openURL(schemeUrl);
            return;
          }
        }
      }
      const storeUrl = Platform.OS === 'ios' ? app.iosLink : app.androidLink;
      if (storeUrl) {
        await Linking.openURL(storeUrl);
      }
    } catch (error) {
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
      <ScrollView
        contentContainerStyle={
          Platform.OS === 'ios' ? { paddingBottom: 100 } : undefined
        }
      >
        <View style={styles.introContainer}>
          <Text style={styles.introText}>
            Lista de aplicaciones móviles (algunas necesarias 🌟, otras
            opcionales ℹ️) que necesitaremos durante el Jubileo.
          </Text>
          <Text style={styles.introSubtext}>
            {Platform.OS === 'web'
              ? 'Si tocas el icono de la app te la abrirá directamente. En el modal puedes elegir entre iOS y Android ✨'
              : 'Si tocas el icono de la app te la abrirá directamente o te llevará a la tienda de tu plataforma ✨'}
          </Text>
        </View>

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
                      <MaterialIcons name="star" size={14} color="#FFF" />
                    </View>
                  </View>
                )}
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelected(app);
                  }}
                  style={styles.plusButton}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="add-circle-outline"
                    size={28}
                    color={scheme === 'dark' ? '#ccc' : '#555'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelected(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modal}>
            {selected && (
              <View>
                <Text style={styles.modalTitle}>{selected.nombre}</Text>
                <Text style={styles.modalDesc}>{selected.descripcion}</Text>
                <View style={styles.chipRow}>
                  <View
                    style={[
                      styles.chip,
                      selected.tipo.toLowerCase() === 'necesaria'
                        ? styles.chipNecesaria
                        : styles.chipOpcional,
                    ]}
                  >
                    <MaterialIcons
                      name={
                        selected.tipo.toLowerCase() === 'necesaria'
                          ? 'star'
                          : 'info'
                      }
                      size={14}
                      color="#fff"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.chipText}>{selected.tipo}</Text>
                  </View>
                </View>
                <View style={styles.downloadRow}>
                  {Platform.OS === 'web' ? (
                    <>
                      <TouchableOpacity
                        style={styles.downloadBtn}
                        onPress={() => Linking.openURL(selected.iosLink)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name="phone-iphone"
                          size={28}
                          color={scheme === 'dark' ? '#fff' : '#333'}
                        />
                        <Text style={styles.downloadBtnLabel}>iOS</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.downloadBtn}
                        onPress={() => Linking.openURL(selected.androidLink)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name="android"
                          size={28}
                          color="#3DDC84"
                        />
                        <Text style={styles.downloadBtnLabel}>Android</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.downloadBtn}
                      onPress={() => openApp(selected)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name={
                          Platform.OS === 'ios' ? 'phone-iphone' : 'android'
                        }
                        size={28}
                        color={
                          Platform.OS === 'ios'
                            ? scheme === 'dark'
                              ? '#fff'
                              : '#333'
                            : '#3DDC84'
                        }
                      />
                      <Text style={styles.downloadBtnLabel}>
                        {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    plusButton: {
      padding: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modal: {
      backgroundColor: theme.background,
      padding: 20,
      margin: 20,
      borderRadius: 8,
      width: '85%',
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
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    chipNecesaria: {
      backgroundColor: '#F5A623',
    },
    chipOpcional: {
      backgroundColor: '#4A90E2',
    },
    chipText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
      fontSize: 14,
    },
    downloadRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 8,
    },
    downloadBtn: {
      alignItems: 'center',
      padding: 12,
    },
    downloadBtnLabel: {
      marginTop: 4,
      fontSize: 12,
      color: theme.text,
    },
  });
};
