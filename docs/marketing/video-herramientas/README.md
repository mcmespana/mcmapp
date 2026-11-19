# Herramientas del vídeo de presentación

Scripts con los que se sacaron las capturas reales y los renders 3D del Reel
(`../VIDEO_PRESENTACION.md`). No forman parte de la app.

## Capturas reales (`capturar.js`)

Playwright con Chromium, viewport de iPhone (393 × 798 pt, escala 3; la
película pone encima la barra de estado). Cierra el aviso de «Añade esta app»
y ejecuta pasos: `click:Texto`, `clickx:Texto exacto`, `clickn:Texto#n`,
`labeln:aria-label#n`, `down:x,y` (toque que sí activan los Pressable de RN
web), `fill:placeholder#valor`, `type:texto`, `scroll:px`, `shot:nombre`.

```bash
node capturar.js cant https://mcm.expo.app/cancionero clickx:Saltar "click:Comunión" shot:lista
```

- **Todo menos Comunica**: la web publicada, `https://mcm.expo.app` (datos reales).
- **Comunica**: NUNCA con datos reales (fichas de menores). Exportación local
  con el servidor de datos inventados y servida con `servir-estatico.js`
  (Metro en modo desarrollo se queda sin memoria al recargar):

  ```bash
  cd mcm-app && EXPO_PUBLIC_COMUNICA_API=fake npx expo export --platform web --output-dir /tmp/dist
  node servir-estatico.js /tmp/dist        # http://127.0.0.1:8090
  ```

  Cuentas del servidor falso (`services/comunica/fake/fixtures.ts`):
  `monitor@ejemplo.org`, `familia@ejemplo.org`… con el código `123456`.

## Piezas en 3D (`render-piezas.html` + `render-piezas.js`)

Renderiza cada `.glb` de `piezas-3d/` y `medallas-3d/` dando una vuelta
entera (48 vistas, hoja de 8 × 6, fondo transparente) con la misma luz que el
visor del pañuelo. Las medallas van comprimidas con Draco: la página ya
carga el decodificador. Necesita `three@0.180.0` junto a la página y un
servidor local en el puerto 8765 con los modelos en `models/`.
