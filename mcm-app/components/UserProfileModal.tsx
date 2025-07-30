import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import BottomSheet from './BottomSheet';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ visible, onClose }: Props) {
  const { profile, setProfile } = useUserProfile();
  const [name, setName] = useState(profile.name);
  const [location, setLocation] = useState(profile.location);
  const scheme = useColorScheme();
  const theme = Colors[scheme];

  useEffect(() => {
    setName(profile.name);
    setLocation(profile.location);
  }, [profile]);

  const save = () => {
    setProfile({ name: name.trim(), location: location.trim() });
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={[styles.title, { color: theme.text }]}>Tu nombre</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.background,
            color: theme.text,
            borderColor: theme.icon,
          },
        ]}
        placeholder="Introduce tu nombre"
        placeholderTextColor={theme.icon}
        value={name}
        onChangeText={setName}
      />
      <Text style={[styles.title, { color: theme.text }]}>Lugar de origen</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.background,
            color: theme.text,
            borderColor: theme.icon,
          },
        ]}
        placeholder="Tu ciudad o comunidad"
        placeholderTextColor={theme.icon}
        value={location}
        onChangeText={setLocation}
      />
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.tint }]}
        onPress={save}
        disabled={!name.trim()}
      >
        <Text style={styles.buttonText}>Guardar</Text>
      </TouchableOpacity>
      <Text style={[styles.disclaimer, { color: theme.icon }]}>
        Usaremos tu nombre para el ranking del Wordle y en tus comentarios
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  disclaimer: { fontSize: 12, textAlign: 'center', marginTop: 12 },
});
