// El cuerpo de una actividad (plan 13): los BLOQUES que trocea el servidor, pintados con componentes nativos. La app no interpreta ni una etiqueta
// HTML (ni `javascript:`, ni `<iframe>`, ni estilos de Word): lo que no es un bloque conocido no se pinta.
//
//   · título 1 = `title`; título 2 = `subhead` en negrita; párrafos seleccionables; listas con su marcador y un segundo nivel con sangría.
//   · aviso = bloque con el tono de información y barra lateral (no una tarjeta dentro de otra).
//   · botón del cuerpo en fantasma (la acción principal es «Inscribirme»); separador hairline.
//   · imagen y galería con `expo-image` (con la sesión si son documentos nuestros) y, al tocarlas, a pantalla completa.
//   · vídeo: miniatura de YouTube o tarjeta de Vimeo con «Ver el vídeo»; nunca un WebView dentro del scroll.
//   · enlaces: `accessibilityRole="link"`, subrayados; solo los que `bodyLinks.ts` sabe abrir (el resto, texto).

import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type {
  BodyBlock,
  BodyInline,
  ImageRef,
} from '@/services/comunica/contract';
import { eventImageSource } from '@/hooks/comunica/useActivities';
import { classifyBodyHref, youtubeThumb } from '@/utils/comunica/bodyLinks';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import ImageViewer from './ImageViewer';

export interface EventBodyProps {
  blocks: readonly BodyBlock[];
  pid: string;
  eventId: string;
  onLink: (
    href: Extract<BodyInline, { t: 'link' }>['href'],
    title?: string,
  ) => void;
}

type Source = {
  uri: string;
  headers?: Record<string, string>;
  cacheKey?: string;
};

export default function EventBody({
  blocks,
  pid,
  eventId,
  onLink,
}: EventBodyProps) {
  const [viewing, setViewing] = useState<{
    source: Source;
    label: string;
  } | null>(null);
  const src = (r: ImageRef) => eventImageSource(pid, eventId, r);
  return (
    <View style={styles.body}>
      {blocks.map((b, i) => (
        <Block
          key={i}
          block={b}
          src={src}
          onLink={onLink}
          onView={(source, label) => setViewing({ source, label })}
        />
      ))}
      <ImageViewer
        source={viewing?.source ?? null}
        label={viewing?.label ?? ''}
        onClose={() => setViewing(null)}
      />
    </View>
  );
}

function Block({
  block,
  src,
  onLink,
  onView,
}: {
  block: BodyBlock;
  src: (r: ImageRef) => Source;
  onLink: EventBodyProps['onLink'];
  onView: (s: Source, label: string) => void;
}) {
  const t = useComunicaTheme();
  switch (block.type) {
    case 'heading':
      return (
        <Text
          accessibilityRole="header"
          selectable
          style={[block.level === 1 ? styles.h1 : styles.h2, { color: t.text }]}
        >
          <Inlines nodes={block.text} onLink={onLink} />
        </Text>
      );
    case 'paragraph':
      return (
        <Text selectable style={[styles.p, { color: t.text }]}>
          <Inlines nodes={block.text} onLink={onLink} />
        </Text>
      );
    case 'notice':
      return (
        <View
          accessibilityRole="alert"
          style={[
            styles.notice,
            {
              backgroundColor: t.chip('info').background,
              borderLeftColor: t.chip('info').text,
            },
          ]}
        >
          <Text selectable style={[styles.p, { color: t.text }]}>
            <Inlines nodes={block.text} onLink={onLink} />
          </Text>
        </View>
      );
    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((item, i) => (
            <View key={i}>
              <ListRow
                marker={block.ordered ? `${block.start + i}.` : '•'}
                level={0}
              >
                <Inlines nodes={item} onLink={onLink} />
              </ListRow>
              {block.children[String(i)]?.items.map((child, j) => (
                <ListRow
                  key={j}
                  marker={block.children[String(i)].ordered ? `${j + 1}.` : '–'}
                  level={1}
                >
                  <Inlines nodes={child} onLink={onLink} />
                </ListRow>
              ))}
            </View>
          ))}
        </View>
      );
    case 'button':
      return (
        <PressableFeedback
          onPress={() => {
            h.tap();
            onLink(block.href, block.label);
          }}
          isDisabled={classifyBodyHref(block.href).kind === 'none'}
          accessibilityRole="link"
          accessibilityLabel={block.label}
          style={[styles.button, { borderColor: t.accentText }]}
        >
          <Text style={[styles.buttonLabel, { color: t.accentText }]}>
            {block.label}
          </Text>
        </PressableFeedback>
      );
    case 'image':
      return (
        <View style={styles.figure}>
          <Picture
            source={src(block.src)}
            label={block.alt ?? block.caption ?? 'Imagen de la actividad'}
            onView={onView}
          />
          {block.caption ? (
            <Text style={[styles.caption, { color: t.textSecondary }]}>
              {block.caption}
            </Text>
          ) : null}
        </View>
      );
    case 'gallery':
      return <Gallery images={block.images} src={src} onView={onView} />;
    case 'video':
      return <VideoCard block={block} />;
    case 'divider':
      return (
        <View style={[styles.divider, { backgroundColor: t.separator }]} />
      );
    default:
      // Un bloque que esta versión no conoce no se pinta (nunca HTML).
      return null;
  }
}

function ListRow({
  marker,
  level,
  children,
}: {
  marker: string;
  level: 0 | 1;
  children: React.ReactNode;
}) {
  const t = useComunicaTheme();
  return (
    <View style={[styles.row, { paddingLeft: level * 20 }]}>
      <Text style={[styles.marker, { color: t.textSecondary }]}>{marker}</Text>
      <Text selectable style={[styles.p, styles.rowText, { color: t.text }]}>
        {children}
      </Text>
    </View>
  );
}

/** Texto en línea: negrita, cursiva, saltos y enlaces (solo los que se saben abrir). */
export function Inlines({
  nodes,
  onLink,
}: {
  nodes: readonly BodyInline[];
  onLink: EventBodyProps['onLink'];
}) {
  const t = useComunicaTheme();
  return (
    <>
      {nodes.map((n, i) => {
        if (n.t === 'text') return n.v;
        if (n.t === 'break') return '\n';
        if (n.t === 'bold' || n.t === 'italic')
          return (
            <Text key={i} style={n.t === 'bold' ? styles.bold : styles.italic}>
              <Inlines nodes={n.c} onLink={onLink} />
            </Text>
          );
        if (!('href' in n)) return null;
        const kind = classifyBodyHref(n.href).kind;
        if (kind === 'none')
          return <Inlines key={i} nodes={n.c} onLink={onLink} />;
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
      })}
    </>
  );
}

function Picture({
  source,
  label,
  onView,
}: {
  source: Source;
  label: string;
  onView: (s: Source, label: string) => void;
}) {
  const t = useComunicaTheme();
  const [ratio, setRatio] = useState(1.5);
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onView(source, label);
      }}
      accessibilityRole="imagebutton"
      accessibilityLabel={`${label}. Ver a pantalla completa`}
    >
      <Image
        source={source}
        contentFit="contain"
        accessibilityLabel={label}
        onLoad={(e) => {
          const { width, height } = e.source;
          if (width && height) setRatio(width / height);
        }}
        style={[
          styles.image,
          { aspectRatio: ratio, backgroundColor: t.backgroundSunken },
        ]}
      />
    </PressableFeedback>
  );
}

function Gallery({
  images,
  src,
  onView,
}: {
  images: readonly ImageRef[];
  src: (r: ImageRef) => Source;
  onView: (s: Source, label: string) => void;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.gallery}>
      {images.map((r, i) => (
        <PressableFeedback
          key={i}
          onPress={() => {
            h.tap();
            onView(src(r), `Foto ${i + 1} de ${images.length}`);
          }}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Foto ${i + 1} de ${images.length}. Ver a pantalla completa`}
          style={styles.cell}
        >
          <Image
            source={src(r)}
            contentFit="cover"
            style={[styles.thumb, { backgroundColor: t.backgroundSunken }]}
          />
        </PressableFeedback>
      ))}
    </View>
  );
}

function VideoCard({
  block,
}: {
  block: Extract<BodyBlock, { type: 'video' }>;
}) {
  const t = useComunicaTheme();
  const label =
    block.provider === 'youtube' ? 'Vídeo de YouTube' : 'Vídeo de Vimeo';
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        void Linking.openURL(block.url).catch(() => undefined);
      }}
      accessibilityRole="link"
      accessibilityLabel={`${label}. Ver el vídeo`}
      style={[styles.video, { backgroundColor: t.backgroundSunken }]}
    >
      {block.provider === 'youtube' ? (
        <Image
          source={{ uri: youtubeThumb(block.id) }}
          contentFit="cover"
          style={styles.videoThumb}
        />
      ) : null}
      <View style={styles.videoRow}>
        <IconSymbol name="arrow.up.right" size={22} color={t.accentText} />
        <Text style={[styles.buttonLabel, { color: t.accentText }]}>
          Ver el vídeo
        </Text>
      </View>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  h1: { ...typography.title, fontWeight: '700' },
  h2: { ...typography.subhead, fontWeight: '700' },
  p: { ...typography.body, lineHeight: 24 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  link: { textDecorationLine: 'underline' },
  notice: { borderLeftWidth: 4, borderRadius: radii.md, padding: 14 },
  list: { gap: 6 },
  row: { flexDirection: 'row', gap: 8 },
  marker: { ...typography.body, width: 22 },
  rowText: { flex: 1 },
  button: {
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonLabel: { ...typography.button },
  figure: { gap: 6 },
  image: { width: '100%', borderRadius: radii.md },
  caption: { ...typography.caption },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48.5%' },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: radii.md },
  divider: { height: StyleSheet.hairlineWidth },
  video: { borderRadius: radii.md, overflow: 'hidden' },
  videoThumb: { width: '100%', aspectRatio: 16 / 9 },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
});
