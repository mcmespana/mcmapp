# Medallas 3D

Modelos `.glb` de las medallas de los eventos, listos para la app. La app los
descarga desde aquí vía jsDelivr:

```
https://cdn.jsdelivr.net/gh/mcmespana/mcmapp@main/medallas-3d/<id>.glb
```

Así que **un archivo solo está disponible cuando ya está en `main`**. La lista
de medallas de prueba está en `mcm-app/components/medallas/labMedals.ts` y el
visor en `mcm-app/components/medallas/`.

| Archivo                    | Medalla                                 |
| -------------------------- | --------------------------------------- |
| `jubileo-jovenes-2025.glb` | Jubileo de los Jóvenes · Roma 2025      |
| `visita-papa-2026.glb`     | Visita del Papa 2026 · "Alza la mirada" |

## Qué formato descargar de la web que las genera

**GLB.** Es un solo archivo con la geometría y las texturas dentro, y es lo
que entiende el visor en iOS, Android y web. USDZ solo sirve en iPhone (para
realidad aumentada) y OBJ/FBX/STL no valen: OBJ deja las texturas aparte, FBX
es para programas de edición y STL no guarda color.

## Cómo dejar una medalla nueva lista (de ~70 MB a ~2 MB)

Los modelos que salen de la web pesan unos 70 MB: texturas de 4096 px en PNG y
un millón de triángulos. En el móvil eso no se puede descargar ni pintar. Se
comprime así (hace falta Node; no instala nada en el proyecto):

```bash
npx -y @gltf-transform/cli@4 optimize original.glb medallas-3d/<id>.glb \
  --compress draco --texture-compress webp --texture-size 1024 \
  --simplify-ratio 0.5 --simplify-error 0.00003
```

- Con esto quedan en ~2 MB y no se distinguen del original.
- **No simplifiques más** (`--simplify-ratio 0.08` deja 600 KB, pero el borde
  de las circulares sale dentado).
- `<id>` en kebab-case: es el mismo id que va en `labMedals.ts`.

## La miniatura

La rejilla (y lo que iría "cosido" en el pañuelo) usa una imagen plana, no el
modelo: pintar varios 3D a la vez se come la batería. Es un WebP de 512 px con
fondo transparente, de frente, en
`mcm-app/assets/images/medallas/<id>.webp`. Se sacó del propio `.glb` con
`<model-viewer>` (`toBlob`) con la misma luz del visor (`environment-image
="neutral"`, `tone-mapping="aces"`, `exposure="1.2"`), para que la miniatura y
el 3D se vean iguales.
