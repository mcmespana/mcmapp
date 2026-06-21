# Plan — Modo Carismochito (onboarding, colección y comportamiento)

> Estado actual: el modo se activa agitando el móvil 5 veces → cuenta atrás 3s →
> activo (tiñe la UI de verde, mascota/overlay). Se desactiva tocando el badge
> flotante o agitando. Persiste entre sesiones.
> Ficheros: `contexts/CarismochitoContext.tsx`, `components/CarismochitoOverlay.tsx`,
> `components/CarismochitoChargeDots.tsx`.
> Fecha: 2026-06-21.

## 1. Ajustes de comportamiento (rápidos, OTA)

- [ ] **Confirmar antes de desactivar**: al intentar salir (tocar badge / agitar)
      mostrar un diálogo "¿Salir del modo Carismochito?" en vez de salir directo.
- [ ] **Agitar más para desactivar**: subir el nº de sacudidas necesarias para
      salir (p.ej. activar = 5, desactivar = 8) o exigir mantener agitando. Hoy
      `SHAKES_NEEDED = 5` y `deactivate()` es inmediato.
- [ ] **El banner de activación NO debe cerrarse al tocarlo**: hoy el badge
      flotante dice "Agita o tócame para salir" y al tocarlo desactiva → es poco
      intuitivo (la gente lo toca por curiosidad y se sale). Que el tap abra la
      **explicación/onboarding** (ver §2) en vez de desactivar; salir solo por
      el flujo de confirmación.

## 2. Onboarding / explicación del modo (OTA)

Primera vez que se activa (o al tocar el badge): un **modal de bienvenida** estilo
onboarding que explique el modo SIN desvelarlo del todo. Contenido propuesto:

- "Has despertado el **Modo Carismochito** 🌟"
- "En este modo podrás encontrar a **Carismochito** escondido por la app."
- Teaser de futuro (sin concretar): "Próximamente podrás **coleccionarlos**…"
- "Mantente atento: pronto se desvelará más."
- Persistir `@carismochito_onboarding_seen` para no repetirlo (con opción de
  reabrirlo desde el badge).

## 3. Carismochito aparece "en todas partes" (OTA, con matices)

Objetivo: la mascota aparece aleatoriamente sobre el contenido en casi toda la
app mientras el modo está activo.

- **Dónde SÍ**: Inicio, Cantoral (lista/categorías), Calendario, Fotos, Contigo,
  hub de eventos, Más, notificaciones…
- **Dónde NO** (no distraer): materiales/profundiza y zonas de lectura de evento,
  y **canción a pantalla completa** (modo presentación / lectura).
- **Implementación**: un componente `CarismochitoSprite` montado en el overlay
  global (`CarismochitoOverlay`, ya está en `_layout.tsx`), que aparece/oculta en
  posiciones aleatorias cada X segundos. Para excluir zonas: un contexto/flag
  `suppressCarismochito` que las pantallas excluidas activan al enfocarse (o
  comprobar la ruta actual con `usePathname`/segments y una lista de exclusión).
- Esfuerzo: medio. Riesgo: bajo (es overlay, no toca la lógica de pantallas).

## 4. Colección / contador (OTA + requiere login)

- Al **tocar** un Carismochito que aparece: animación especial (rebote + destello
  + háptica) y **+1 al contador**.
- Mostrar un **contador** (en el badge o en un panel del modo).
- **Solo para sesión iniciada**: si no hay login, avisar "Inicia sesión para no
  perder tu progreso" (el contador se guardaría en RTDB por usuario, p.ej.
  `users/<uid>/carismochitos`). Sin login: no se cuenta (o efímero).
- Copy: "Esto estará disponible solo para cuentas con sesión iniciada — atento,
  próximamente se descubrirá más."
- Esfuerzo: medio. Riesgo: bajo-medio (persistencia por usuario).

## 5. Icono de la app en verde/Carismochito (NATIVO — build de tienda)

> Ya existe un item en `TODO.md` (Prioridad baja). Resumen aquí por contexto.

- Cambiar el icono del launcher al activar el modo requiere **iconos
  alternativos**: iOS `setAlternateIconName`, Android `activity-alias`
  (`expo-dynamic-app-icon` o similar).
- ⚠️ **Código nativo** → build de tienda, no OTA; los iconos van empaquetados.
- ⚠️ Persiste fuera de la app (hay que revertirlo al desactivar el modo).
- ⚠️ Android: el swap es tosco (al ir a segundo plano, puede reiniciar atajos).
- Decidir si compensa para un modo efímero por agitado.

## Orden sugerido

1. Comportamiento (§1) + onboarding (§2) — OTA, alto impacto, bajo riesgo.
2. Aparición global (§3).
3. Colección + contador con login (§4).
4. Icono alternativo (§5) — para una release de tienda.
