import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';

export default function LoginSection() {
  const {
    user,
    profile,
    profiles,
    signInWithGoogle,
    signInWithApple,
    signOut,
    setProfile,
  } = useAuth();
  const scheme = useColorScheme();
  const theme = Colors[scheme];

  if (!user) {
    return (
      <View style={styles.section}>
        <TouchableOpacity style={styles.button} onPress={signInWithGoogle}>
          <Text style={[styles.buttonText, { color: theme.text }]}>
            Iniciar con Google
          </Text>
        </TouchableOpacity>
        {Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.button} onPress={signInWithApple}>
            <Text style={[styles.buttonText, { color: theme.text }]}>
              Iniciar con Apple
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme.text }]}>
        Sesión iniciada como
      </Text>
      <Text style={[styles.value, { color: theme.text }]}>
        {user.displayName || user.email}
      </Text>
      <Picker
        selectedValue={profile}
        style={{ color: theme.text }}
        onValueChange={(val) => setProfile(String(val))}
      >
        {profiles.map((p) => (
          <Picker.Item label={p} value={p} key={p} />
        ))}
      </Picker>
      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={[styles.buttonText, { color: theme.text }]}>
          Cerrar sesión
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  button: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: 'bold',
  },
  label: {
    marginBottom: 4,
  },
  value: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
});
