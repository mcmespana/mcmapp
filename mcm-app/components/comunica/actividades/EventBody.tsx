// El cuerpo de un evento (la «información de la web»), pintado con
// componentes nativos a partir de los BLOQUES que trocea el servidor (plan 13
// «El cuerpo»; `inc/eventos-cuerpo.php` es el troceador original y su pintor
// web, el modelo). La app es otro pintor de esos bloques: no interpreta ni una
// etiqueta de HTML (ni `javascript:`, ni `<iframe>`, ni estilos de Word).
//
//   · título 1 → `h3`; título 2 → `title` en negrita
//   · párrafo → `body`, seleccionable; aviso → bloque informativo con barra
//   · listas con su marcador y un segundo nivel con más sangría
//   · botón → fantasma (la acción principal de la ficha es «Inscribirme»)
//   · imagen, galería (rejilla de dos), vídeo (miniatura o tarjeta, que abre
//     la app de YouTube o el navegador: nada de WebView dentro del scroll)
//   · separador hairline
//
// Los enlaces los decide quien lo monta (`onLink`), con `bodyLinks.ts`.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import type {
  BodyBlock,
  BodyHref,
  BodyInline,
  ImageRef,
} from '@/services/comunica/contract';
import { isLinkable, youtubeThumbnail } from '@/utils/comunica/bodyLinks';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import EventMedia, { type ImageResolver } from './EventMedia';

interface Props {
  blocks: BodyBlock[];
  resolve: ImageResolver;
  onLink: (href: BodyHref) => void;
  onImage: (image: ImageRef, alt: string) => void;
  onVideo: (url: string) => void;
}

/** El texto plano de unos inlines (para el lector y los `alt`). */
export function plainText(nodes: BodyInline[]): string {
  return nodes
    .map((n) =>
      n.t === 'text' ? n.v : n.t === 'break' ? '\n' : plainText(n.c),
    )
    .join('');
}

function Inlines({
  nodes,
  onLink,
}: {
  nodes: BodyInline[];
  onLink: (href: BodyHref) => void;
}) {
  const t = useComunicaTheme();
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case 'text':
            return n.v;
          case 'break':
            return '\n';
          case 'bold':
            return (
              <Text key={i} style={styles.bold}>
                <Inlines nodes={n.c} onLink={onLink} />
              </Text>
            );
          case 'italic':
            return (
              <Text key={i} style={styles.italic}>
                <Inlines nodes={n.c} onLink={onLink} />
              </Text>
            );
          case 'link':
            // Lo que no se sabe abrir se pinta como texto, no como enlace.
            if (!isLinkable(n.href)) {
              return <Inlines key={i} nodes={n.c} onLink={onLink} />;
            }
            return (
              <Text
                key={i}
                accessibilityRole="link"
                onPress={() => onLink(n.href)}
                style={[styles.link, { color: t.accentText }]}
              >
                <Inlines nodes={n.c} onLink={onLink} />
              </Text>
            );
        }
        return null;
      })}
    </>
  );
}

function ListItems({
  ordered,
  start,
  items,
  sublists,
  onLink,
  nested = false,
}: {
  ordered: boolean;
  start: number;
  items: BodyInline[][];
  sublists?: Record<string, { ordered: boolean; items: BodyInline[][] }>;
  onLink: (href: BodyHref) => void;
  nested?: boolean;
}) {
  const t = useComunicaTheme();
  return (
    <View style={[styles.list, nested && styles.nested]}>
      {items.map((item, i) => {
        const sub = sublists?.[String(i)];
        return (
          <View key={i}>
            <View style={styles.item}>
              <Text
                style={[styles.marker, { color: t.textSecondary }]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {ordered ? `${start + i}.` : '•'}
              </Text>
              <Text
                selectable
                style={[styles.body, styles.itemText, { color: t.text }]}
              >
                <Inlines nodes={item} onLink={onLink} />
              </Text>
            </View>
            {sub ? (
              <ListItems
                ordered={sub.ordered}
                start={1}
                items={sub.items}
                onLink={onLink}
                nested
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function VideoCard({
  block,
  onVideo,
}: {
  block: Extract<BodyBlock, { type: 'video' }>;
  onVideo: (url: string) => void;
}) {
  const t = useComunicaTheme();
  const youtube = block.provider === 'youtube';
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onVideo(block.url);
      }}
      accessibilityRole="link"
      accessibilityLabel={`Ver el vídeo en ${youtube ? 'YouTube' : 'Vimeo'}`}
      style={[styles.video, { backgroundColor: t.card }]}
    >
      {youtube ? (
        <Image
          source={{ uri: youtubeThumbnail(block.id) }}
          contentFit="cover"
          style={styles.thumb}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={styles.videoRow}>
        <IconSymbol name="play.rectangle.fill" size={22} color={t.accentText} />
        <Text style={[styles.videoLabel, { color: t.accentText }]}>
          Ver el vídeo
        </Text>
        <Text style={[styles.videoProvider, { color: t.textSecondary }]}>
          {youtube ? 'YouTube' : 'Vimeo'}
        </Text>
      </View>
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

export default function EventBody({
  blocks,
  resolve,
  onLink,
  onImage,
  onVideo,
}: Props) {
  const t = useComunicaTheme();
  const info = t.chip('info');
  return (
    <View style={styles.wrap} testID="event-body">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading':
            return (
              <Text
                key={i}
                accessibilityRole="header"
                style={[
                  b.level === 1 ? styles.h1 : styles.h2,
                  { color: t.text },
                ]}
              >
                <Inlines nodes={b.text} onLink={onLink} />
              </Text>
            );
          case 'paragraph':
            return (
              <Text key={i} selectable style={[styles.body, { color: t.text }]}>
                <Inlines nodes={b.text} onLink={onLink} />
              </Text>
            );
          case 'notice':
            return (
              <View
                key={i}
                style={[
                  styles.notice,
                  { backgroundColor: info.background, borderLeftColor: t.link },
                ]}
              >
                <Text selectable style={[styles.body, { color: t.text }]}>
                  <Inlines nodes={b.text} onLink={onLink} />
                </Text>
              </View>
            );
          case 'list':
            return (
              <ListItems
                key={i}
                ordered={b.ordered}
                start={b.start}
                items={b.items}
                sublists={b.children}
                onLink={onLink}
              />
            );
          case 'button':
            if (!isLinkable(b.href)) return null;
            return (
              <PressableFeedback
                key={i}
                onPress={() => {
                  h.tap();
                  onLink(b.href);
                }}
                accessibilityRole="link"
                style={[styles.ghost, { borderColor: t.accentText }]}
              >
                <Text style={[styles.ghostLabel, { color: t.accentText }]}>
                  {b.label}
                </Text>
                <IconSymbol
                  name="chevron.right"
                  size={14}
                  color={t.accentText}
                />
              </PressableFeedback>
            );
          case 'image': {
            const alt = b.alt || b.caption || 'Imagen de la actividad';
            return (
              <View key={i} style={styles.figure}>
                <EventMedia
                  image={b.src}
                  resolve={resolve}
                  alt={alt}
                  onPress={() => onImage(b.src, alt)}
                />
                {b.caption ? (
                  <Text style={[styles.caption, { color: t.textSecondary }]}>
                    {b.caption}
                  </Text>
                ) : null}
              </View>
            );
          }
          case 'gallery':
            return (
              <Gallery
                key={i}
                images={b.images}
                resolve={resolve}
                onImage={onImage}
              />
            );
          case 'video':
            return <VideoCard key={i} block={b} onVideo={onVideo} />;
          case 'divider':
            return (
              <View
                key={i}
                style={[styles.divider, { backgroundColor: t.separator }]}
              />
            );
        }
        return null;
      })}
    </View>
  );
}

/** Rejilla de dos columnas; tocar una la abre entera. */
export function Gallery({
  images,
  resolve,
  onImage,
}: {
  images: ImageRef[];
  resolve: ImageResolver;
  onImage: (image: ImageRef, alt: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {images.map((img, i) => {
        const alt = `Foto ${i + 1} de ${images.length}`;
        return (
          <EventMedia
            key={'documentId' in img ? img.documentId : img.url}
            image={img}
            resolve={resolve}
            alt={alt}
            cover
            onPress={() => onImage(img, alt)}
            style={styles.cell}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  h1: { ...typography.h3, marginTop: 6 },
  h2: { ...typography.title, fontWeight: '700' },
  body: { ...typography.body },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  link: { textDecorationLine: 'underline' },
  notice: {
    borderLeftWidth: 3,
    borderRadius: radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  list: { gap: 6 },
  nested: { paddingLeft: 24 },
  item: { flexDirection: 'row', gap: 8 },
  marker: { ...typography.body, minWidth: 18, textAlign: 'right' },
  itemText: { flex: 1 },
  ghost: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderRadius: radii.md,
  },
  ghostLabel: { ...typography.button },
  figure: { gap: 6 },
  caption: { ...typography.caption, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48%', flexGrow: 1 },
  video: { borderRadius: radii.lg, overflow: 'hidden' },
  thumb: { width: '100%', aspectRatio: 16 / 9 },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
  },
  videoLabel: { ...typography.button, flex: 1 },
  videoProvider: { ...typography.caption },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
