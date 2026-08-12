import React from 'react';
import { View, Text } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import colors from '@/constants/colors';
import { isMe, normalize, type SearchHit } from './gruposHelpers';
import type { GruposStyles } from './gruposStyles';

// Resalta la parte del texto que coincide con la búsqueda. Solo se usa en la
// fila de resultado, por eso vive aquí.
function highlightText(text: string, query: string, styles: GruposStyles) {
  if (!query) return <Text style={styles.hitText}>{text}</Text>;
  const nText = normalize(text);
  const nQuery = normalize(query);
  const idx = nText.indexOf(nQuery);
  if (idx === -1) return <Text style={styles.hitText}>{text}</Text>;
  return (
    <Text style={styles.hitText}>
      {text.substring(0, idx)}
      <Text style={styles.hitTextMatch}>
        {text.substring(idx, idx + query.length)}
      </Text>
      {text.substring(idx + query.length)}
    </Text>
  );
}

interface SearchHitRowProps {
  hit: SearchHit;
  query: string;
  myName: string;
  styles: GruposStyles;
  onPress: () => void;
}

// Fila de un resultado de búsqueda (coincidencia en nombre de grupo,
// responsable o miembro), con el texto coincidente resaltado. Extraído de
// GruposScreen.
const SearchHitRow = React.memo(function SearchHitRow({
  hit,
  query,
  myName,
  styles,
  onPress,
}: SearchHitRowProps) {
  const me = !!hit.miembro && isMe(hit.miembro, myName);
  return (
    <PressableFeedback
      onPress={onPress}
      style={[styles.hitRow, me && styles.hitRowMe]}
      accessibilityRole="button"
    >
      <PressableFeedback.Highlight />
      <View style={styles.hitLeft}>
        <MaterialIcons
          name={
            hit.isGroupName ? 'group' : hit.isResponsable ? 'badge' : 'person'
          }
          size={18}
          color={me ? colors.accent : '#888'}
        />
      </View>
      <View style={styles.hitBody}>
        {hit.isGroupName ? (
          <>
            {highlightText(hit.grupo.nombre, query, styles)}
            {hit.grupo.subtitulo ? (
              <Text style={styles.hitMeta} numberOfLines={1}>
                {hit.grupo.subtitulo}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            {highlightText(hit.miembro || '', query, styles)}
            <Text style={styles.hitMeta} numberOfLines={1}>
              {hit.isResponsable ? 'Acompaña a ' : 'En '}
              {hit.grupo.nombre}
            </Text>
          </>
        )}
      </View>
      {me ? <Text style={styles.youBadge}>tú</Text> : null}
      <MaterialIcons name="chevron-right" size={20} color="#bbb" />
    </PressableFeedback>
  );
});

export default SearchHitRow;
