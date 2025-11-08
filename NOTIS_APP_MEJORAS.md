# Mejoras y Problemas en el Sistema de Notificaciones de la App

## 🚨 Problemas Identificados

### 1. **Problema Crítico: ID de Notificación No Coincide**

**Problema:**
Cuando se recibe una notificación push, la app usa `notification.request.identifier` que es generado por Expo, pero este ID **NO coincide** con el `notificationId` que se guarda en Firebase.

**Ubicación:** `mcm-app/notifications/usePushNotifications.ts` líneas 55 y 92

**Código Actual:**
```typescript
const receivedNotification: ReceivedNotification = {
  id: notification.request.identifier, // ⚠️ Este ID no coincide con Firebase
  // ...
};
```

**Solución:**
El backend debe enviar el `notificationId` de Firebase en `data.id`, y la app debe usar ese ID en lugar de `notification.request.identifier`:

```typescript
const receivedNotification: ReceivedNotification = {
  id: notification.request.content.data?.id || notification.request.identifier, // Usar data.id si existe
  // ...
};
```

**Archivo a modificar:** `mcm-app/notifications/usePushNotifications.ts`

---

### 2. **Falta Sincronización en Tiempo Real**

**Problema:**
La pantalla de notificaciones no se suscribe a cambios en tiempo real de Firebase. Solo carga las notificaciones cuando se abre la pantalla.

**Solución:**
Usar `subscribeToNotifications` que ya existe en `pushNotificationService.ts`:

```typescript
// En notifications.tsx
useEffect(() => {
  const unsubscribe = subscribeToNotifications((firebaseNotifs) => {
    setNotifications(firebaseNotifs);
  });

  return () => unsubscribe();
}, []);
```

**Archivo a modificar:** `mcm-app/app/notifications.tsx`

---

### 3. **No se Actualiza el Contador Cuando Llega una Notificación en Foreground**

**Problema:**
Cuando llega una notificación mientras la app está abierta, el contador de notificaciones sin leer no se actualiza automáticamente.

**Solución:**
Actualizar el contador cuando se recibe una notificación:

```typescript
// En usePushNotifications.ts
notificationListener.current =
  Notifications.addNotificationReceivedListener(async (notification) => {
    // ... código existente ...
    
    // Actualizar contador después de guardar
    await saveReceivedNotificationLocally(receivedNotification);
    
    // Emitir evento o usar un contexto global para actualizar contador
    // O simplemente refrescar el hook si está activo
  });
```

**Mejor solución:**
Crear un contexto global para el contador que se actualice automáticamente:

```typescript
// contexts/NotificationsContext.tsx
export const NotificationsContext = createContext({
  unreadCount: 0,
  refreshCount: () => {},
});

// En usePushNotifications.ts, emitir evento cuando llegue notificación
// En useUnreadNotificationsCount, escuchar eventos y actualizar
```

**Archivos a crear/modificar:**
- `mcm-app/contexts/NotificationsContext.tsx` (nuevo)
- `mcm-app/hooks/useUnreadNotificationsCount.ts` (modificar)
- `mcm-app/notifications/usePushNotifications.ts` (modificar)

---

### 4. **Manejo de Errores Mejorable**

**Problema:**
Algunos errores se manejan silenciosamente con `console.error`, pero no se muestran al usuario.

**Solución:**
Añadir manejo de errores más robusto y mostrar mensajes al usuario cuando sea apropiado:

```typescript
// Ejemplo en notifications.tsx
const loadNotifications = async () => {
  try {
    // ... código existente ...
  } catch (error) {
    console.error('Error cargando notificaciones:', error);
    // Mostrar mensaje al usuario si es crítico
    // O al menos registrar en analytics
  }
};
```

---

### 5. **Optimización: Caché de Notificaciones**

**Problema:**
Cada vez que se abre la pantalla de notificaciones, se hacen múltiples llamadas a Firebase y AsyncStorage.

**Solución:**
Implementar caché y solo refrescar cuando sea necesario:

```typescript
// Usar React Query o similar para caché
// O implementar un sistema de caché manual
const [notificationsCache, setNotificationsCache] = useState<NotificationData[]>([]);
const [cacheTimestamp, setCacheTimestamp] = useState<number>(0);
const CACHE_DURATION = 60000; // 1 minuto

const loadNotifications = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cacheTimestamp > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
    return; // Usar caché
  }
  
  // ... cargar notificaciones ...
  setCacheTimestamp(now);
};
```

---

### 6. **Mejora UX: Loading States**

**Problema:**
No hay indicadores de carga claros cuando se están cargando las notificaciones.

**Solución:**
Añadir skeleton loaders o spinners más visibles:

```typescript
// En notifications.tsx
{loading ? (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" />
    <Text>Cargando notificaciones...</Text>
  </View>
) : (
  // ... contenido ...
)}
```

---

### 7. **Mejora: Notificaciones Agrupadas**

**Problema:**
Las notificaciones se muestran todas juntas sin agrupación por fecha.

**Solución:**
Agrupar notificaciones por fecha:

```typescript
const groupedNotifications = useMemo(() => {
  const groups: Record<string, NotificationData[]> = {};
  
  allNotifications.forEach(notification => {
    const date = new Date('receivedAt' in notification ? notification.receivedAt : notification.createdAt);
    const dateKey = formatDateGroup(date); // "Hoy", "Ayer", "Esta semana", etc.
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(notification);
  });
  
  return groups;
}, [allNotifications]);
```

---

### 8. **Mejora: Filtros y Búsqueda**

**Problema:**
No hay forma de filtrar o buscar notificaciones.

**Solución:**
Añadir filtros por categoría y búsqueda por texto:

```typescript
const [filterCategory, setFilterCategory] = useState<NotificationCategory | 'all'>('all');
const [searchQuery, setSearchQuery] = useState('');

const filteredNotifications = useMemo(() => {
  return allNotifications.filter(notification => {
    if (filterCategory !== 'all' && notification.category !== filterCategory) {
      return false;
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return notification.title.toLowerCase().includes(query) ||
             notification.body.toLowerCase().includes(query);
    }
    
    return true;
  });
}, [allNotifications, filterCategory, searchQuery]);
```

---

### 9. **Mejora: Marcar Todas como Leídas**

**Problema:**
No hay forma de marcar todas las notificaciones como leídas de una vez.

**Solución:**
Añadir botón "Marcar todas como leídas":

```typescript
const markAllAsRead = async () => {
  const unreadNotifications = allNotifications.filter(
    notification => !readIds.has(notification.id)
  );
  
  await Promise.all(
    unreadNotifications.map(n => markNotificationAsRead(n.id))
  );
  
  await loadNotifications();
  refreshUnreadCount();
};
```

---

### 10. **Mejora: Notificaciones Locales Programadas**

**Problema:**
No se pueden programar notificaciones locales desde la app.

**Solución:**
Usar `expo-notifications` para programar notificaciones locales:

```typescript
import * as Notifications from 'expo-notifications';

const scheduleLocalNotification = async (
  title: string,
  body: string,
  trigger: Date
) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
    },
    trigger,
  });
};
```

---

## 📋 Checklist de Mejoras

### Críticas (Hacer Primero)

- [ ] **Corregir ID de notificación** - Usar `data.id` en lugar de `identifier`
- [ ] **Añadir sincronización en tiempo real** - Usar `subscribeToNotifications`
- [ ] **Actualizar contador automáticamente** - Cuando llegue notificación en foreground

### Importantes

- [ ] **Mejorar manejo de errores** - Mostrar mensajes al usuario
- [ ] **Optimizar carga** - Implementar caché
- [ ] **Mejorar UX de loading** - Añadir skeleton loaders

### Opcionales (Mejoras de UX)

- [ ] **Agrupar notificaciones por fecha**
- [ ] **Añadir filtros y búsqueda**
- [ ] **Marcar todas como leídas**
- [ ] **Notificaciones locales programadas**

---

## 🔧 Implementación de Mejoras Críticas

### 1. Corregir ID de Notificación

**Archivo:** `mcm-app/notifications/usePushNotifications.ts`

```typescript
// Línea 55 - Listener de notificaciones recibidas
const receivedNotification: ReceivedNotification = {
  id: notification.request.content.data?.id || notification.request.identifier, // ⚠️ Usar data.id primero
  title: notification.request.content.title || 'Notificación',
  body: notification.request.content.body || '',
  // ... resto del código ...
};

// Línea 92 - Listener de respuesta a notificación
const receivedNotification: ReceivedNotification = {
  id: response.notification.request.content.data?.id || response.notification.request.identifier, // ⚠️ Usar data.id primero
  title: response.notification.request.content.title || 'Notificación',
  body: response.notification.request.content.body || '',
  // ... resto del código ...
};
```

### 2. Añadir Sincronización en Tiempo Real

**Archivo:** `mcm-app/app/notifications.tsx`

```typescript
import { subscribeToNotifications } from '@/services/pushNotificationService';

// En el componente
useEffect(() => {
  // Suscribirse a cambios en tiempo real
  const unsubscribe = subscribeToNotifications((firebaseNotifs) => {
    setNotifications(firebaseNotifs);
    // También actualizar readIds si es necesario
  });

  return () => unsubscribe();
}, []);
```

### 3. Actualizar Contador Automáticamente

**Opción A: Usar EventEmitter (Simple)**

```typescript
// Crear events/notifications.ts
import { EventEmitter } from 'events';
export const notificationEvents = new EventEmitter();

// En usePushNotifications.ts
notificationListener.current =
  Notifications.addNotificationReceivedListener(async (notification) => {
    // ... código existente ...
    await saveReceivedNotificationLocally(receivedNotification);
    notificationEvents.emit('notification-received');
  });

// En useUnreadNotificationsCount.ts
useEffect(() => {
  const handler = () => updateCount();
  notificationEvents.on('notification-received', handler);
  return () => notificationEvents.off('notification-received', handler);
}, []);
```

**Opción B: Usar Context (Mejor para apps grandes)**

Crear un contexto global para notificaciones que maneje el estado y actualice automáticamente.

---

## 📝 Notas

- Las mejoras críticas deben implementarse antes de hacer pruebas exhaustivas
- Las mejoras de UX pueden implementarse gradualmente
- Considerar usar una librería de state management (Zustand, Redux) si la app crece

