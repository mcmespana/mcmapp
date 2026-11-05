# Recordatorios de Contigo

Avisos del propio móvil para el **evangelio**, el **ratito de oración** y la
**revisión del día**. Se entra por la campanita de la cabecera de Contigo
(`app/(tabs)/contigo/recordatorios.tsx`).

## Qué puede configurar la persona (por hábito)

- Encender o apagar el recordatorio. Vienen **apagados**; al encender el primero
  se pide el permiso de notificaciones (una vez).
- **Hasta 3 avisos al día**, con su hora. Por defecto: evangelio 08:00, oración
  13:00, revisión 21:30.
- Los **días de la semana** (todos por defecto, siempre al menos uno).
- El **texto**: uno de los predefinidos o el suyo (hasta 120 caracteres).

El 2.º y el 3.º aviso **solo suenan si ese día aún no has hecho el hábito**.
Al tocar un aviso se abre la pantalla del hábito (evangelio, oración o revisión);
no entra en la campanita de notificaciones.

## Dónde se editan los textos

**`mcm-app/constants/contigoReminderTexts.ts`** y nada más. Cada hábito tiene
`title`, `first` (los que se pueden elegir para el primer aviso; el primero viene
marcado) y `again` (los de insistencia del 2.º y 3.º, que rotan). Son JS, salen
por OTA. Si la persona escribe un texto propio, sustituye a todos los avisos de
ese hábito.

## Cómo funciona por dentro

Un aviso local no puede mirar si has hecho el hábito cuando suena. Por eso **no
se programa nada repetido**: se programan los avisos de los **próximos 7 días**
uno a uno (`planReminders`, en `utils/contigoReminders.ts`) y se recalcula todo
cuando algo cambia:

- al abrir la app y al volver a primer plano (`ContigoRemindersBackground`),
- al tocar un ajuste (`useContigoReminders`),
- al marcar un hábito como hecho (`ContigoHabitsContext.mutateRecords`): a ese
  hábito no le quedan avisos hoy.

`syncContigoReminders()` (`services/contigoReminders.ts`) borra todo lo que
empiece por `contigo-rem-` y reprograma el plan; es idempotente y va en cola (una
sincronización a la vez). Sin permiso no programa nada. En web no hay avisos
(`contigoReminders.web.ts`): la configuración se guarda y no suena.

Límites que hay que conocer:

- iOS admite **64** notificaciones locales pendientes en toda la app. El plan se
  recorta a 56 (`MAX_SCHEDULED`), los más próximos, y Comunica usa una.
- Si pasan más de **7 días sin abrir la app**, los avisos se acaban hasta que se
  vuelva a abrir. Es el precio de poder cancelar «solo si no lo has hecho».
- Android: canal propio `contigo-recordatorios` (importancia alta, para poder
  silenciarlo sin tocar el resto). **No se quita ni cambia de importancia**
  (`__tests__/notificationChannels.test.ts`).

## Datos

- Configuración: AsyncStorage `@contigo_reminders` (`ReminderConfig`). **Solo
  local**: no se sincroniza con Firebase.
- Hábitos hechos: los lee de `@contigo_habits` (los escribe
  `ContigoHabitsContext`). Las claves están en `constants/contigoStorage.ts`.

## Notificación

`data = { contigoReminder: true, habit, internalRoute }`. El `internalRoute` sale
de una lista cerrada (`REMINDER_ROUTES`); `usePushNotifications` no obedece
ninguna otra. En primer plano se enseña el banner (a diferencia de los push del
Panel, aquí no hay duplicado que evitar).

## Pendiente / ideas

- Botón «Ya recé» / «Más tarde» en la propia notificación (categorías de
  `expo-notifications`).
- Los recordatorios podrían crecer a Live Activities de iOS (futuro, build
  nativa).
- Hacer los avisos generales (no solo estos tres hábitos): `planReminders` ya
  recorre una lista de hábitos; añadir uno es añadir su entrada, sus textos y su
  «hecho».
