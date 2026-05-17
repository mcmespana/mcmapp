/**
 * Banner persistente del modo Coro. Se muestra en SongDetailScreen
 * (y desde cualquier sitio donde lo añadamos). Indica:
 *   - el código activo,
 *   - el rol (maestro o esclavo),
 *   - el tono que está dictando el maestro (si hay canción actual),
 *   - botón "Usar mi tono" para que el esclavo se desincronice del tono,
 *   - botón "Salir" / "Cerrar sesión".
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useToast } from 'heroui-native';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { transposeLabel } from '@/utils/transposeKey';

interface Props {
  /** Si true, el banner se muestra en posición fija arriba (no en flujo). */
  floating?: boolean;
  /** Margen superior cuando es floating (típicamente insets.top). */
  topOffset?: number;
}

const ChoirSessionBanner: React.FC<Props> = ({ floating, topOffset = 0 }) => {
  const {
    mode,
    code,
    session,
    overrideTranspose,
    setOverrideTranspose,
    leave,
  } = useChoirSession();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const { toast } = useToast();

  if (mode === 'off' || !code) return null;

  const handleShare = () => {
    const url = `https://mcm.expo.app/coro?c=${code}`;
    const desktopLike =
      Platform.OS === 'web' ||
      Platform.OS === 'windows' ||
      Platform.OS === 'macos';
    if (desktopLike) {
      void Clipboard.setStringAsync(url);
      toast.show({ label: 'Enlace copiado al portapapeles' });
    } else {
      Share.share({ message: `Únete al coro con este enlace:\n${url}` }).catch(
        () => {},
      );
    }
  };

  const masterTranspose = session?.current?.transpose ?? 0;
  const isOverriding = overrideTranspose !== null;
  const effectiveTranspose = isOverriding
    ? overrideTranspose!
    : masterTranspose;

  return (
    <View
      style={[
        styles.banner,
        floating
          ? {
              position: 'absolute',
              top: topOffset,
              left: 8,
              right: 8,
              zIndex: 50,
            }
          : undefined,
      ]}
    >
      <View style={styles.left}>
        <View style={styles.icon}>
          <MaterialIcons
            name={mode === 'master' ? 'campaign' : 'headphones'}
            size={16}
            color="#fff"
          />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.role}>
            {mode === 'master' ? 'Líder de coro' : 'Coro'} · {code}
          </Text>
          <Text style={styles.detail}>
            {session?.current ? (
              <>
                Tono:{' '}
                {effectiveTranspose === 0
                  ? 'original'
                  : `${transposeLabel(effectiveTranspose)} st`}
                {isOverriding ? ' (local)' : ''}
              </>
            ) : (
              <>Sin canción aún</>
            )}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={handleShare}
          hitSlop={6}
        >
          <MaterialIcons name="share" size={16} color="#fff" />
        </TouchableOpacity>
        {mode === 'slave' && session?.current ? (
          isOverriding ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setOverrideTranspose(null)}
            >
              <MaterialIcons name="sync" size={16} color="#fff" />
              <Text style={styles.actionText}>Sincronizar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setOverrideTranspose(masterTranspose)}
            >
              <MaterialIcons name="tune" size={16} color="#fff" />
              <Text style={styles.actionText}>Mi tono</Text>
            </TouchableOpacity>
          )
        ) : null}
        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={() => leave()}
          hitSlop={6}
        >
          <MaterialIcons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#253883',
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginHorizontal: 12,
      marginTop: 6,
      gap: 8,
      ...Platform.select({
        web: { boxShadow: '0 2px 10px rgba(37,56,131,0.35)' },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
          elevation: 4,
        },
      }),
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    icon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    textBlock: {
      flex: 1,
    },
    role: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: 0.2,
    },
    detail: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 1,
    },
    right: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 9,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    actionText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    leaveBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default ChoirSessionBanner;
