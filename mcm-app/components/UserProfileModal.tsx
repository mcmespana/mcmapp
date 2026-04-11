import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet from './BottomSheet';
import { Button, TextField, Input } from 'heroui-native';
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
      <TextField style={styles.field}>
        <Input placeholder="Tu nombre" value={name} onChangeText={setName} />
      </TextField>
      <TextField style={styles.field}>
        <Input
          placeholder="Tu ciudad o comunidad"
          value={location}
          onChangeText={setLocation}
        />
      </TextField>
      <Button
        variant="primary"
        isDisabled={!name.trim()}
        onPress={save}
        style={styles.button}
      >
        <Button.Label>Guardar</Button.Label>
      </Button>
      <Text style={[styles.disclaimer, { color: theme.icon }]}>
        Usaremos tu nombre para el ranking del Wordle y en tus comentarios
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  button: { marginTop: 8 },
  disclaimer: { fontSize: 12, textAlign: 'center', marginTop: 12 },
});
