/**
 * Payload multi-path para publicar una reflexión de forma atómica: escribe
 * la entrada bajo `data/<key>` y toca `updatedAt` en la misma operación
 * (`update()`), de modo que ningún dispositivo pueda ver la entrada nueva
 * sin que `updatedAt` ya haya cambiado (y viceversa). Antes eran dos `set()`
 * separados: si el segundo fallaba (o la app moría entre medias), la
 * reflexión quedaba escrita pero invisible para el resto de dispositivos —
 * `useFirebaseData` solo redescarga `data` cuando `updatedAt` difiere.
 */
export function buildReflexionUpdate(
  key: string,
  reflexion: object,
  now: number,
): Record<string, unknown> {
  return {
    [`data/${key}`]: reflexion,
    updatedAt: String(now),
  };
}
