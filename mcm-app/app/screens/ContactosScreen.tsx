import React from 'react';
import { ScrollView, Platform, Linking } from 'react-native';
import { Avatar, ListGroup, Separator, Button, Surface } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import colors from '@/constants/colors';
import { UIColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const AVATAR_COLORS = [
  'accent',
  'success',
  'warning',
  'danger',
  'default',
] as const;

type AvatarColor = (typeof AVATAR_COLORS)[number];

interface Contacto {
  nombre: string;
  responsabilidad: string;
  telefono: string;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getAvatarColor(index: number): AvatarColor {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export default function ContactosScreen() {
  const scheme = useColorScheme();
  const { data: contacts, loading } = useFirebaseData<Contacto[]>(
    'jubileo/contactos',
    'jubileo_contactos',
  );
  const data = contacts as Contacto[] | undefined;

  const call = (tel: string) => Linking.openURL(`tel:${tel}`);
  const whatsapp = (tel: string) => {
    const clean = tel.replace('+', '');
    Linking.openURL(`https://wa.me/${clean}`);
  };

  if (!data) {
    return <ProgressWithMessage message="Cargando contactos..." />;
  }

  if (loading) {
    return <ProgressWithMessage message="Actualizando contactos..." />;
  }

  return (
    <ScrollView
      contentContainerStyle={[
        { padding: 16 },
        Platform.OS === 'ios' && { paddingBottom: 100 },
      ]}
    >
      <Surface variant="default" className="overflow-hidden rounded-2xl">
        <ListGroup variant="transparent">
          {(data || []).map((c, idx) => (
            <React.Fragment key={idx}>
              <ListGroup.Item onPress={() => {}}>
                <ListGroup.ItemPrefix>
                  <Avatar size="md" color={getAvatarColor(idx)} alt={c.nombre}>
                    <Avatar.Fallback>{getInitials(c.nombre)}</Avatar.Fallback>
                  </Avatar>
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{c.nombre}</ListGroup.ItemTitle>
                  <ListGroup.ItemDescription>
                    {c.responsabilidad}
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    onPress={() => call(c.telefono)}
                  >
                    <MaterialIcons name="phone" size={20} color={colors.info} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    onPress={() => whatsapp(c.telefono)}
                  >
                    <MaterialIcons
                      name="chat"
                      size={20}
                      color={colors.success}
                    />
                  </Button>
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
              {idx < (data?.length ?? 0) - 1 && <Separator className="ml-20" />}
            </React.Fragment>
          ))}
        </ListGroup>
      </Surface>
    </ScrollView>
  );
}
