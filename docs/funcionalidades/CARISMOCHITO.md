# Modo Carismochito

> Documento **vivo**: describe cómo funciona hoy. El plan que lo construyó está
> archivado en [`../planes/archivo/PLAN_CARISMOCHITO.md`](../planes/archivo/PLAN_CARISMOCHITO.md).

## El modo (para todo el mundo)

- **Se activa agitando el móvil 5 veces** → cuenta atrás de 3 s → la app se
  tiñe de verde, confeti, y el icono del launcher cambia (esto último, desde la
  build de tienda 2.1). Se recuerda al reabrir la app.
- La primera vez sale una **explicación** del modo; después se reabre tocando el
  aviso flotante.
- **Para salir**: un par de sacudidas fuertes → pide confirmación.
- Mientras está activo, **Carismochito se asoma por los bordes** de vez en
  cuando (cada 45-90 s), menos en pantallas de lectura y presentación:
  evangelio, oración, canción a pantalla completa, materiales y profundiza
  (`hooks/useSuppressCarismochito.ts`, que va por foco de pantalla).

Código: `contexts/CarismochitoContext.tsx` (la máquina de estados),
`components/CarismochitoOverlay.tsx` (cuenta atrás, confeti, asomadas),
`components/CarismochitoDialogs.tsx`, `components/CarismochitoMascot.tsx`.

## La caza y la colección (solo pruebas)

**Escondida a propósito** (decisión del usuario, 2026-09-26): solo existe para
quien la enciende en el **Laboratorio Alpha** (7 toques en la versión de la app,
en Inicio o en Más → sección "Caza de Carismochitos"). No hay enlace desde
ningún otro sitio. Sin encenderla, todo es como arriba.

Con la caza encendida y el modo activo:

- Se asoma más a menudo (20-45 s) y un poco más de rato (3 s).
- Sale en una de **8 variantes**, sorteadas por peso: común (clásico, de campo),
  poco común (celeste, MIC, COM), raro (LC, nocturno) y legendario (dorado).
- **Tocarlo lo atrapa**: vibración, animación de salida y un toast.
- La colección se ve en `app/carismochito.tsx`: anillo de progreso, contador y
  una ficha por variante (silueta mientras no la has encontrado). Si se entra
  por enlace directo sin la caza encendida, redirige a Inicio.
- Desde el laboratorio: ver la colección, forzar una aparición y empezar de cero.

### Datos

```
AsyncStorage  @carismochito_hunt_enabled   '1' | '0'
AsyncStorage  @carismochito_collection     { <variantId>: { count, firstAt } }
RTDB          users/{uid}/carismochitos/{variantId} = { count, firstAt }
```

- Sin sesión se guarda solo en el móvil (la pantalla lo avisa).
- Con sesión se fusiona con la nube por el **máximo** de cada variante (no la
  suma: abrir la app no duplica). Lo que el móvil lleve de más se sube.
- La regla de RTDB que lo cubre es la de `users/$uid` (solo el dueño).
- **Los `id` de variante son contrato** (`utils/carismochitoCollection.ts`): se
  pueden añadir variantes o cambiar pesos y nombres, pero no renombrar ni
  reutilizar un `id`.

Código: `utils/carismochitoCollection.ts` (puro: catálogo, sorteo, fusión),
`contexts/CarismochitoHuntContext.tsx`, `components/preview-channel/CarismochitoLabPanel.tsx`,
paletas en `constants/colors.ts` (`CarismochitoPalettes`).

Analítica: `carismochito_activado` y `carismochito_atrapado { rareza, nuevo }`.

## Lo que queda por decidir

- **Cuándo sale la caza del laboratorio** para todo el mundo (y si entonces la
  colección se enlaza desde algún sitio). Está en `docs/planes/BACKLOG.md` §4.
- **Dónde vivirá la colección a la larga**: la idea es una vista de perfil con
  logros, chapas y Carismochitos — ver `docs/planes/PLAN_PANEL_PANUELO.md`.
