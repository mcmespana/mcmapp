import React from 'react';
import { View, Text } from 'react-native';
import colors from '@/constants/colors';
import { isMe } from './gruposHelpers';
import type { GruposStyles } from './gruposStyles';

interface MemberRowProps {
  name: string;
  myName: string;
  styles: GruposStyles;
}

// Fila de un miembro dentro del detalle de un grupo, resaltando al usuario
// actual ("tú"). Extraído de GruposScreen.
const MemberRow = React.memo(function MemberRow({
  name,
  myName,
  styles,
}: MemberRowProps) {
  const me = isMe(name, myName);
  return (
    <View style={[styles.memberRow, me && styles.memberRowMe]}>
      <View
        style={[
          styles.dot,
          { backgroundColor: me ? colors.accent : '#C0C0C8' },
        ]}
      />
      <Text
        style={[styles.memberText, me && styles.memberTextMe]}
        numberOfLines={2}
      >
        {name}
      </Text>
      {me ? <Text style={styles.youBadge}>tú</Text> : null}
    </View>
  );
});

export default MemberRow;
