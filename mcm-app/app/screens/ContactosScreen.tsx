import React from 'react';
import { ScrollView, StyleSheet, View, Linking } from 'react-native';
import { List, IconButton, Avatar } from 'react-native-paper';
import contacts from '@/assets/jubileo-contactos.json';
import colors from '@/constants/colors';

interface Contacto {
  nombre: string;
  responsabilidad: string;
  telefono: string;
}

export default function ContactosScreen() {
  const data = contacts as Contacto[];

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const call = (tel: string) => Linking.openURL(`tel:${tel}`);
  const whatsapp = (tel: string) => {
    const clean = tel.replace('+', '');
    Linking.openURL(`https://wa.me/${clean}`);
  };

  return (
    <ScrollView style={styles.container}>
      {data.map((c, idx) => (
        <List.Item
          key={idx}
          title={c.nombre}
          titleStyle={styles.name}
          description={c.responsabilidad}
          left={() => (
            <Avatar.Text
              size={40}
              label={getInitials(c.nombre)}
              style={styles.avatar}
            />
          )}
          right={() => (
            <View style={styles.actions}>
              <IconButton icon="phone" size={24} onPress={() => call(c.telefono)} />
              <IconButton
                icon="whatsapp"
                size={24}
                onPress={() => whatsapp(c.telefono)}
              />
            </View>
          )}
          contentStyle={styles.itemContent}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  actions: { flexDirection: 'row' },
  name: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  avatar: { marginLeft: 8 },
  itemContent: { paddingVertical: 8 },
});
