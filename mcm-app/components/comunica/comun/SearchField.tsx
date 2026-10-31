// El buscador de las listas del área (Grupos y fichas, la lista de un
// evento): lupa, campo y borrar. Va DENTRO de la lista, no pegado: los chips
// sí se pegan arriba (como en el plugin).

import React from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useComunicaTheme } from './useComunicaTheme';

export default function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const t = useComunicaTheme();
  return (
    <View style={[styles.search, { backgroundColor: t.card }]}>
      <IconSymbol name="magnifyingglass" size={16} color={t.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        accessibilityLabel={placeholder.replace(/…$/, '')}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        style={[styles.searchInput, { color: t.text }]}
        {...(Platform.OS === 'web' ? {} : { returnKeyType: 'search' as const })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    minHeight: 44,
  },
  searchInput: { ...typography.body, flex: 1, paddingVertical: 8 },
});
