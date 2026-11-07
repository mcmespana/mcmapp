import React, { useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * PARCHE de versión vieja (rama `hotfix/ota-rt-*`, 2026-11-07): esta versión ya
 * tiene una nueva en las tiendas. Cartel en Inicio que lleva a la tienda y se
 * puede cerrar; vuelve a salir a los 3 días. Va «a mano» y sin condiciones
 * porque esta rama solo la reciben las versiones viejas.
 */
const DISMISS_KEY = 'storeUpdateBannerDismissedAt';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

const IOS_APP_ID = '6753905393';
const ANDROID_PACKAGE = 'com.mcmespana.mcmapp';

async function openStore() {
  const [native, web] =
    Platform.OS === 'ios'
      ? [
          `itms-apps://apps.apple.com/app/id${IOS_APP_ID}`,
          `https://apps.apple.com/app/id${IOS_APP_ID}`,
        ]
      : [
          `market://details?id=${ANDROID_PACKAGE}`,
          `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
        ];
  try {
    await Linking.openURL(native);
  } catch {
    Linking.openURL(web).catch(() => {});
  }
}

export default function StoreUpdateBanner() {
  const isDark = useColorScheme() === 'dark';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    AsyncStorage.getItem(DISMISS_KEY)
      .then((v) => {
        const at = v ? Number(v) : 0;
        setVisible(!at || Date.now() - at > SNOOZE_MS);
      })
      .catch(() => setVisible(true));
  }, []);

  if (!visible) return null;

  const close = () => {
    setVisible(false);
    AsyncStorage.setItem(DISMISS_KEY, String(Date.now())).catch(() => {});
  };

  return (
    <View
      style={[styles.card, { backgroundColor: isDark ? '#1E2A5A' : '#EEF1FA' }]}
    >
      <Pressable
        onPress={openStore}
        style={styles.body}
        accessibilityRole="button"
        accessibilityLabel="Hay una versión nueva de la app. Toca para ir a la tienda"
      >
        <View style={styles.icon}>
          <MaterialIcons name="system-update" size={22} color="#fff" />
        </View>
        <View style={styles.texts}>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#253883' }]}>
            Hay una versión nueva
          </Text>
          <Text style={[styles.sub, { color: isDark ? '#C7CCE0' : '#3C4470' }]}>
            Actualízala en la tienda: unos 30 segundos y todo sigue como lo
            dejaste.
          </Text>
          <Text style={[styles.cta, { color: isDark ? '#95d2f2' : '#253883' }]}>
            Actualizar →
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={close}
        hitSlop={12}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="Cerrar aviso de versión nueva"
      >
        <MaterialIcons
          name="close"
          size={20}
          color={isDark ? '#C7CCE0' : '#3C4470'}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  body: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#253883',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 13, lineHeight: 18 },
  cta: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  close: { padding: 4, marginLeft: 4 },
});
