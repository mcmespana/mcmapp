# CONTIGO_COMPARTIR.md — Compartir, exportar y «Tu año»

> Noviembre de 2026. Tres cosas de Contigo que sacan fuera lo que es de cada
> uno. Solo JS (sin paquetes nuevos): salen por OTA. Sin probar en móvil.

## Compartir el evangelio como imagen

En la cabecera del evangelio del día (icono de compartir) y, al final de las
lecturas, un enlace discreto: **Compartir como imagen**. Abre una hoja con la vista previa, cuatro estilos (Papel, Noche,
Color, Blanco), dos formatos (Historia 1080×1920, Cuadrada 1080×1080) y un
botón. La frase es **tu subrayado** de ese día (con flechas si hay varios, de
cualquier lectura) y lleva su color; sin subrayados, el arranque del evangelio.

## Exportar subrayados y revisiones

En **Guardados**, el icono de compartir de la cabecera: se elige qué
(frases subrayadas, revisiones del día) y se saca en **PDF** o **solo texto**.
Lee lo guardado en el móvil (`@contigo_bookmarks` y `@contigo_revision_*`); no
pasa por ningún servidor.

## Tu año en Contigo

Pantalla con el año (con flechas si hay más), cuatro cifras (días contigo,
días seguidos, minutos de oración, frases subrayadas) y los meses, cada uno con
sus días en cuadritos y, al abrirlo, sus frases subrayadas (tocar una abre las
lecturas de ese día). Abajo, **Compartir mi año**.

**Dónde está** (`utils/contigoRecapSeason.ts`):

- **Casi todo el año**: una línea discreta al final de la portada de Contigo.
- **En temporada**, una tarjeta dorada arriba, bajo el evangelio del día, con
  un brillo que la recorre y la estrella que respira:
  - la semana de antes de Adviento y sus dos primeras semanas;
  - de la última semana de Adviento al 21 de enero (en enero resume el año que
    acaba de terminar).
- Tras **tres visitas** a «Tu año» en esa temporada la tarjeta se queda quieta
  (`@contigo_recap_opens`). Con «reducir movimiento», nunca se anima.

## Cómo se hace la imagen

Sin capturar la pantalla y sin paquetes nuevos: la tarjeta se describe como
una lista de rectángulos y textos sobre un lienzo de 1080 px
(`utils/shareCard.ts`) y se pinta con `react-native-svg`, que en iOS y Android
ya exporta a PNG (`toDataURL`). En web, el mismo dibujo en SVG pasa por un
canvas. El texto se parte a mano por número de letras, tirando a estrecho y
centrado.

| Archivo | Qué es |
| ------- | ------ |
| `utils/shareCard.ts` | Estilos, partir y ajustar texto, tarjeta del evangelio y del año, SVG en texto |
| `components/contigo/ShareCardView.tsx` | Pinta la tarjeta y la comparte como PNG |
| `components/contigo/ShareCardSheet.tsx` | La hoja (vista previa, estilo, formato) |
| `utils/contigoExport.ts` + `services/contigoExport.ts` | Frases compartibles, y la exportación a texto/HTML/PDF |
| `components/contigo/ExportSheet.tsx` | La hoja de exportar |
| `utils/contigoRecap.ts` + `app/(tabs)/contigo/resumen.tsx` | Las cuentas del año y su pantalla |

Tests: `contigoShareExport.test.ts`.
