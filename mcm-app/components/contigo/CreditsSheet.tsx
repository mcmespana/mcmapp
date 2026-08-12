import React from 'react';
import {
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet from '@/components/BottomSheet';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii } from '@/constants/uiStyles';

interface CreditsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const SOURCES = [
  {
    name: 'Vatican News',
    copyright: `© 2017-${new Date().getFullYear()} Dicasterium pro Communicatione`,
    url: 'https://www.vaticannews.va/es/evangelio-de-hoy',
    urlLabel: 'vaticannews.va/es/evangelio-de-hoy',
    extra: 'webmaster@vaticannews.va',
  },
  {
    name: 'Vida Nueva',
    copyright: `© ${new Date().getFullYear()} Copyright Vida Nueva`,
    url: 'https://www.vidanuevadigital.com/evangeliodeldia/',
    urlLabel: 'vidanuevadigital.com/evangeliodeldia',
  },
  {
    name: 'Dominicos · Orden de Predicadores',
    copyright:
      'Textos bíblicos de la Versión oficial de la Conferencia Episcopal Española. Editorial BAC',
    url: 'https://www.dominicos.org/predicacion/evangelio-del-dia/hoy/',
    urlLabel: 'dominicos.org/predicacion/evangelio-del-dia/hoy',
  },
];

/** Fuentes de los textos de la sección Contigo. */
export function CreditsSheet({ visible, onClose }: CreditsSheetProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const accent = isDark ? '#DAA520' : '#C4922A';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Fuentes de los textos"
    >
      <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 20, paddingBottom: 20 }}
        >
          <Text style={{ fontSize: 15, lineHeight: 22, color: theme.text }}>
            Los textos bíblicos y los comentarios que te mostramos en la
            aplicación están extraídos de webs que los comparten de forma
            gratuita en abierto. Junto a los comentarios se indica su autor de
            la misma forma que se muestra en la web original.
          </Text>

          {SOURCES.map((s) => (
            <View
              key={s.name}
              style={{
                backgroundColor: cardBg,
                padding: 16,
                borderRadius: radii.lg,
                gap: 4,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: '700', color: theme.text }}
              >
                {s.name}
              </Text>
              <Text style={{ fontSize: 13, color: theme.icon, lineHeight: 18 }}>
                {s.copyright}
              </Text>
              <TouchableOpacity onPress={() => Linking.openURL(s.url)}>
                <Text
                  style={{
                    fontSize: 13,
                    color: accent,
                    textDecorationLine: 'underline',
                    marginTop: 4,
                  }}
                >
                  {s.urlLabel}
                </Text>
              </TouchableOpacity>
              {s.extra ? (
                <Text style={{ fontSize: 13, color: theme.icon, marginTop: 4 }}>
                  {s.extra}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}
