import React from 'react';
import { ScrollView, StyleSheet, Linking } from 'react-native';
import { Card } from 'react-native-paper';
import contactsData from '@/assets/jubileo-contactos.json';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { ThemedText } from '@/components/ThemedText';

interface Contacto {
  nombre: string;
  responsabilidad: string;
  telefono: string;
}

export default function ContactosScreen() {
  const contactos: Contacto[] = contactsData as Contacto[];

  const handlePress = (telefono: string) => {
    Linking.openURL(`tel:${telefono}`);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {contactos.map((c, idx) => (
        <Card key={idx} style={styles.card} onPress={() => handlePress(c.telefono)}>
          <Card.Title
            title={<ThemedText style={styles.title}>{c.nombre}</ThemedText>}
            subtitle={<ThemedText style={styles.subtitle}>{c.responsabilidad}</ThemedText>}
            right={() => <ThemedText style={styles.phone}>{c.telefono}</ThemedText>}
          />
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text,
  },
  phone: {
    fontSize: 16,
    color: colors.accent,
    marginRight: spacing.md,
  },
});
