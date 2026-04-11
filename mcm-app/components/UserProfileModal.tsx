import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import BottomSheet from './BottomSheet';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
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
  const isDark = scheme === 'dark';
  const theme = Colors[scheme];

  useEffect(() => {
    setName(profile.name);
    setLocation(profile.location);
  }, [profile]);

  const save = () => {
    setProfile({ name: name.trim(), location: location.trim() });
    onClose();
  };

  const canSave = name.trim().length > 0;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={22} color={theme.icon} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Tu perfil</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={[styles.fieldLabel, { color: theme.text }]}>Nombre</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
              color: theme.text,
              borderColor: name.trim()
                ? '#34C759'
                : isDark ? '#3A3A3C' : '#E5E5EA',
            },
          ]}
          placeholder="Tu nombre"
          placeholderTextColor={theme.icon}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          maxLength={80}
        />

        <Text style={[styles.fieldLabel, { color: theme.text }]}>Comunidad o ciudad</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
              color: theme.text,
              borderColor: location.trim()
                ? '#34C759'
                : isDark ? '#3A3A3C' : '#E5E5EA',
            },
          ]}
          placeholder="Tu ciudad o comunidad"
          placeholderTextColor={theme.icon}
          value={location}
          onChangeText={setLocation}
          returnKeyType="done"
          onSubmitEditing={canSave ? save : undefined}
          maxLength={80}
        />

        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: canSave ? '#007AFF' : isDark ? '#3A3A3C' : '#E5E5EA' },
          ]}
          onPress={save}
          disabled={!canSave}
          activeOpacity={0.8}
        >
          <MaterialIcons name="check" size={18} color={canSave ? '#fff' : theme.icon} />
          <Text style={[styles.saveBtnText, { color: canSave ? '#fff' : theme.icon }]}>
            Guardar
          </Text>
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: theme.icon }]}>
          Usaremos tu nombre para el ranking del Wordle y en tus comentarios
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: radii.md,
    marginTop: 24,
    marginBottom: 12,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
