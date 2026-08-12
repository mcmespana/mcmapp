import { View, TextInput, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { GruposStyles } from './gruposStyles';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  styles: GruposStyles;
  isDark: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
}

// Barra de búsqueda propia (TextInput) en vez del SearchField de heroui:
// garantiza texto blanco legible en modo oscuro y un alto cómodo idéntico en
// iOS y Android. Extraído de GruposScreen.
export default function SearchBar({
  value,
  onChangeText,
  placeholder,
  styles,
  isDark,
  autoCapitalize = 'none',
}: SearchBarProps) {
  const iconColor = isDark ? '#C5C5C7' : '#8E8E93';
  return (
    <View style={styles.searchBar}>
      <MaterialIcons name="search" size={22} color={iconColor} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#8E8E93' : '#A0A0A8'}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        underlineColorAndroid="transparent"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
        >
          <MaterialIcons name="cancel" size={20} color={iconColor} />
        </Pressable>
      ) : null}
    </View>
  );
}
