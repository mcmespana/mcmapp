import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Modal from 'react-native-modal';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import useFontScale from '@/hooks/useFontScale';
import { useAppSettings, ThemeScheme } from '@/contexts/AppSettingsContext';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import useProfiles from '@/hooks/useProfiles';
import { Picker } from '@react-native-picker/picker';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ visible, onClose }: Props) {
  const { settings, setSettings } = useAppSettings();
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  const fontScale = useFontScale();
  const { user, profile, signInWithGoogle, signInWithApple, signOutUser, setProfile } = useAuth();
  const enableApple = process.env.EXPO_PUBLIC_ENABLE_APPLE_SIGNIN === 'true';
  const profiles = useProfiles();
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  useEffect(() => {
    setSelectedProfile(profile?.profile ?? null);
  }, [profile]);

  const increase = () => {
    setSettings({ fontScale: Math.min(settings.fontScale + 0.1, 2) });
  };

  const decrease = () => {
    setSettings({ fontScale: Math.max(1, settings.fontScale - 0.1) });
  };

  const setTheme = (theme: ThemeScheme) => {
    setSettings({ theme });
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={styles.modal}
      swipeDirection="down"
      onSwipeComplete={onClose}
      backdropOpacity={0.3}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {user ? (
          <>
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <Text style={{ color: theme.text, fontWeight: 'bold' }}>
                  {user.displayName?.split(' ').map(w => w[0]).join('').slice(0,2)}
                </Text>
                {profile?.admin && (
                  <MaterialIcons name="star" size={16} color={theme.text} style={{ position: 'absolute', top: -4, right: -4 }} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: 'bold' }}>{user.displayName}</Text>
                <Text style={{ color: theme.text, fontSize: 12 }}>{user.email}</Text>
              </View>
              <TouchableOpacity onPress={signOutUser}>
                <MaterialIcons name="logout" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={{ marginVertical: 10 }}>
              <Text style={{ color: theme.text, marginBottom: 4 }}>Perfil</Text>
              <Picker
                selectedValue={selectedProfile ?? undefined}
                onValueChange={(v) => { setSelectedProfile(v); setProfile(v); }}
                style={{ color: theme.text }}
              >
                {profiles.map(p => (
                  <Picker.Item label={p} value={p} key={p} />
                ))}
              </Picker>
            </View>
          </>
        ) : (
          <View style={styles.loginContainer}>
            <TouchableOpacity style={styles.loginButton} onPress={signInWithGoogle}>
              <FontAwesome name="google" size={24} color={theme.text} />
              <Text style={[styles.loginText, { color: theme.text }]}>Iniciar sesión con Google</Text>
            </TouchableOpacity>
            {enableApple && Platform.OS !== 'android' && (
              <TouchableOpacity style={styles.loginButton} onPress={signInWithApple}>
                <FontAwesome name="apple" size={24} color={theme.text} />
                <Text style={[styles.loginText, { color: theme.text }]}>Iniciar sesión con Apple</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <View style={styles.row}>
          <TouchableOpacity onPress={decrease} disabled={settings.fontScale <= 1}>
            <MaterialIcons name="text-fields" size={24} color={theme.text} style={{ transform: [{ scaleY: 0.8 }] }} />
          </TouchableOpacity>
          <Text style={[styles.value, { color: theme.text, fontSize: 16 * fontScale }]}>{(settings.fontScale * 100).toFixed(0)}%</Text>
          <TouchableOpacity onPress={increase}>
            <MaterialIcons name="text-fields" size={32} color={theme.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.themeToggleRow}>
          <TouchableOpacity
            onPress={() => setTheme('light')}
            style={[
              styles.themeButton,
              settings.theme === 'light' && styles.themeSelected,
            ]}
          >
            <MaterialIcons name="light-mode" size={28} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTheme('dark')}
            style={[
              styles.themeButton,
              settings.theme === 'dark' && styles.themeSelected,
            ]}
          >
            <MaterialIcons name="dark-mode" size={28} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTheme('system')}
            style={[
              styles.themeButton,
              settings.theme === 'system' && styles.themeSelected,
            ]}
          >
            <MaterialIcons name="brightness-auto" size={28} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { justifyContent: 'flex-end', margin: 0 },
  container: {
    padding: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  value: {
    fontWeight: 'bold',
  },
  themeToggleRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  themeButton: {
    opacity: 0.6,
  },
  themeSelected: {
    opacity: 1,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  loginContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  loginText: {
    marginLeft: 8,
    fontWeight: 'bold',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
});
