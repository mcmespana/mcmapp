import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { isMe, type Grupo } from './gruposHelpers';
import type { GruposStyles } from './gruposStyles';

interface GrupoCardProps {
  grupo: Grupo;
  myName: string;
  styles: GruposStyles;
  onPress: () => void;
}

// Tarjeta de un grupo en la lista de una categoría, con recuento de miembros y
// marca "tú" si el usuario está dentro. Extraído de GruposScreen.
const GrupoCard = React.memo(function GrupoCard({
  grupo,
  myName,
  styles,
  onPress,
}: GrupoCardProps) {
  // Quick check: is "me" in this group? (only matters if a name is set)
  const meIn = useMemo(() => {
    if (!myName) return false;
    if (isMe(grupo.responsable, myName)) return true;
    return (grupo.miembros || []).some((m) => isMe(m, myName));
  }, [grupo, myName]);
  const count = grupo.miembros?.length || 0;
  return (
    <PressableFeedback
      onPress={onPress}
      style={[styles.grupoCard, meIn && styles.grupoCardMe]}
      accessibilityRole="button"
      accessibilityLabel={`Abrir grupo ${grupo.nombre}`}
    >
      <PressableFeedback.Highlight />
      <View style={styles.grupoCardMain}>
        <Text style={styles.grupoCardTitle} numberOfLines={1}>
          {grupo.nombre}
        </Text>
        {grupo.subtitulo ? (
          <Text style={styles.grupoCardSubtitle} numberOfLines={1}>
            {grupo.subtitulo}
          </Text>
        ) : null}
        <View style={styles.grupoCardMetaRow}>
          {grupo.responsable ? (
            <Text style={styles.grupoCardMeta} numberOfLines={1}>
              <MaterialIcons name="person" size={12} /> {grupo.responsable}
            </Text>
          ) : null}
          <Text style={styles.grupoCardMeta}>
            <MaterialIcons name="group" size={12} /> {count}
          </Text>
        </View>
      </View>
      {meIn ? <Text style={styles.youBadge}>tú</Text> : null}
      <MaterialIcons name="chevron-right" size={22} color="#999" />
    </PressableFeedback>
  );
});

export default GrupoCard;
