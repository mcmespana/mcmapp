# Plan 003: Corregir la expansión de eventos multi-día del calendario (DST) e investigar la zona horaria del ICS

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/hooks/useCalendarEvents.ts`
> If the file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S (parte A, fix mecánico) + S (parte B, investigación acotada)
- **Risk**: LOW (A) / MED (B — por eso B es investigar-antes-de-tocar)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

**Parte A (fix directo):** al expandir un evento multi-día, el bucle mezcla
tres sistemas horarios: parsea `'YYYY-MM-DD'` como medianoche **UTC**, avanza
días con `setDate()` (hora de pared **local**) y formatea con
`toISOString()` (**UTC** otra vez). Al cruzar el cambio de hora de
primavera de Europa/Madrid, el instante retrocede 1 h y `toISOString()` cae
en el día UTC anterior: un evento del 28-mar al 2-abr emite `28, 29, 29 (dup),
31…` — un día duplicado, otro que desaparece, y el final un día antes. La
última semana de marzo es exactamente la ventana de Semana Santa/retiros para
la que se usa este calendario, y tanto la pestaña Calendario como la Home
pintan desde este mapa.

**Parte B (investigar, luego decidir):** el parser ignora por completo la zona
horaria del ICS — ni el sufijo `Z` (UTC) ni el parámetro `;TZID=` se miran.
Si el feed real (Google `basic.ics`) emite horas como UTC con `Z`, que es lo
habitual, cada evento con hora se muestra 1-2 h antes de lo real. Pero si el
feed emite horas "flotantes" locales, convertir incondicionalmente rompería
todo — por eso B es primero verificación contra el feed real.

## Current state

- `mcm-app/hooks/useCalendarEvents.ts` — descarga y parsea todos los ICS.
  Sin fichero de test hoy (no existe `__tests__/useCalendarEvents.test.ts`
  ni test de `parseICS`).

Bucle multi-día (líneas ~205-218, dentro de `fetchAndParseCalendars`):

```ts
} else {
  // For multi-day events, iterate through the range
  const start = new Date(ev.startDate);   // 'YYYY-MM-DD' → medianoche UTC
  const end = new Date(ev.endDate);
  for (
    let d = new Date(start);
    d <= end;
    d.setDate(d.getDate() + 1)            // avanza en hora LOCAL
  ) {
    const dateStr = d.toISOString().split('T')[0];  // formatea en UTC
    if (!map[dateStr]) map[dateStr] = [];
    map[dateStr].push(withCal);
  }
}
```

Parseo de `DTSTART` (líneas ~103-126) — nótese que ni `Z` ni `TZID` se
inspeccionan:

```ts
} else if (line.startsWith('DTSTART')) {
  const idx = line.indexOf(':');
  if (idx !== -1) {
    const value = line.slice(idx + 1).trim();
    const isDateOnly = !value.includes('T') && /^\d{8}$/.test(value);
    if (isDateOnly) current.isAllDay = true;
    const datePart = value.replace(/T.*$/, '');
    if (/^\d{8}$/.test(datePart)) {
      /* …extrae YYYY-MM-DD… */
    }
    const timeMatch = value.match(/T(\d{2})(\d{2})/);
    if (timeMatch && !isDateOnly) {
      current.startTime = `${timeMatch[1]}:${timeMatch[2]}`;
    }
  }
}
```

- `DTEND` (líneas ~127-143) tiene la misma forma.
- El repo ya tiene un helper de fechas locales: `mcm-app/utils/localDate.ts`
  (exporta `localISO`) — usarlo como referencia de estilo para helpers puros
  de fecha con test.
- Convenciones: helpers puros a `utils/` con test en el mismo PR (regla de
  `docs/planes/PLAN_CALIDAD.md` Fase 1.3/5.4); comentarios en español;
  imports con `@/`.
- Los feeds reales están configurados en Firebase (`jubileo/calendarios`) y el
  default en `mcm-app/hooks/useCalendarConfigs.ts` (~líneas 44-48) apunta a un
  export público de Google Calendar (`…/public/basic.ics`).

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)          | Expected on success |
|-----------|-------------------------------------|---------------------|
| Install   | `npm ci`                            | exit 0              |
| Typecheck | `npx tsc --noEmit`                  | exit 0              |
| Tests     | `npm test -- calendar`              | all pass            |
| Tests     | `npm test`                          | all pass            |
| Lint      | `npm run lint`                      | exit 0              |
| Feed real (parte B) | `curl -s "<URL del basic.ics de useCalendarConfigs.ts>" \| grep -m5 "^DTSTART"` | líneas DTSTART visibles |

## Scope

**In scope**:

- `mcm-app/hooks/useCalendarEvents.ts`
- `mcm-app/utils/` — nuevo helper de fechas si se extrae (p. ej. `addDaysISO`)
- `mcm-app/__tests__/useCalendarEvents.test.ts` (crear) o
  `mcm-app/__tests__/calendarDates.test.ts` para los helpers puros

**Out of scope** (do NOT touch):

- `mcm-app/app/(tabs)/calendario.tsx` y `app/(tabs)/index.tsx` — consumidores;
  el mapa que reciben no cambia de forma.
- `mcm-app/hooks/useCalendarConfigs.ts` — solo se LEE para la parte B.
- La descarga serial / falta de TTL del mismo archivo ([PERF-01] del índice):
  hallazgo aparte, plan aparte. No mezclar.
- `SUMMARY` sin des-escapar (`\,`): cosmético; puede incluirse SOLO si no
  añade riesgo (una línea reutilizando el unescape de DESCRIPTION), si no,
  dejarlo.

## Git workflow

- Branch: la que indique el operador (o `advisor/003-calendar-multiday-dst`).
- Estilo de commit: `fix(calendario): expansión multi-día estable ante cambios de hora`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1 (Parte A): expansión multi-día con aritmética de calendario pura

Sustituir el bucle `Date`/`setDate`/`toISOString` por aritmética que nunca
salga del calendario civil. Patrón recomendado (helper puro, exportado para
test):

```ts
/** Suma `n` días a una fecha 'YYYY-MM-DD' sin pasar por la hora local. */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d + n);
  const nd = new Date(t);
  const mm = String(nd.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(nd.getUTCDate()).padStart(2, '0');
  return `${nd.getUTCFullYear()}-${mm}-${dd}`;
}
```

y en el bucle: iterar `for (let cur = ev.startDate; cur <= ev.endDate; cur = addDaysISO(cur, 1))`
(la comparación lexicográfica de `YYYY-MM-DD` es correcta). Todo queda en UTC
de punta a punta: parseo, incremento y formato en el mismo sistema.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2 (Parte A): tests de tabla del rango

Crear el test con al menos estos casos:

- Rango normal sin DST: `2026-07-01` → `2026-07-03` = 3 días exactos.
- **Primavera**: `2026-03-28` → `2026-04-02` = `[28,29,30,31,01,02]` — sin
  duplicados, sin huecos (este caso FALLA con el código viejo).
- **Otoño**: rango cruzando `2026-10-25` — mismo criterio.
- Evento de un día (`isSingleDay` / sin `endDate`): una sola clave.
- `addDaysISO` con fin de mes y fin de año.

**Verify**: `npm test -- calendar` → all pass. Además, comprobar que los
casos DST fallan si se revierte el fix (mutación mental: el test debe estar
atado al bug).

### Step 3 (Parte B): verificar qué emite el feed real — NO tocar código aún

Descargar el ICS de la URL default de `useCalendarConfigs.ts` (comando en la
tabla) y clasificar sus `DTSTART`:

- `DTSTART:YYYYMMDDTHHMMSSZ` (sufijo Z) → el feed emite **UTC**: el bug de
  hora mostrada existe. Continuar al Step 4.
- `DTSTART;TZID=Europe/Madrid:…` → emite con zona explícita: el bug existe
  solo si la TZID difiere del dispositivo. Continuar al Step 4 (rama TZID).
- Solo `VALUE=DATE` (eventos de día entero) o valores flotantes sin Z →
  **el bug de hora no se materializa con los datos reales**. STOP de la parte
  B: anotar el resultado en `plans/README.md` (fila de este plan → DONE con
  nota "B: feed solo emite fechas / flotantes, sin cambio") y terminar.

**Verify**: salida del `curl` pegada en el resumen final del executor.

### Step 4 (Parte B, condicional): normalizar la hora según lo encontrado

Solo si el Step 3 encontró `Z` (o `TZID` distinta del dispositivo):

- Separar `(params, value)` en `DTSTART`/`DTEND` partiendo por el primer `:`.
- Con sufijo `Z`: construir `Date.UTC(...)` con los componentes y derivar
  `startDate` (`YYYY-MM-DD` local) y `startTime` (`HH:MM` local) con getters
  locales del `Date` resultante — la conversión UTC→local es exactamente lo
  que `Date` hace bien.
- Con `TZID=`: si (y solo si) la TZID es `Europe/Madrid` y el dispositivo
  también, no hay conversión que hacer; cualquier otro caso → STOP y
  reportar (implementar zonas IANA a mano queda fuera de este plan).
- Valores flotantes (sin Z, sin TZID): dejarlos EXACTAMENTE como hoy.
- Tests nuevos: `DTSTART:20260315T220000Z` (→ día local correcto aunque la
  hora UTC caiga en otro día), `DTSTART;VALUE=DATE:20260315` (día entero,
  sin hora), flotante → sin conversión.

**Verify**: `npm test` → all pass; `npm run lint` → exit 0.

## Test plan

- Fichero nuevo (`__tests__/useCalendarEvents.test.ts`): exportar `parseICS` y
  el helper (`addDaysISO`) si no lo están ya, y cubrir la lista de los Steps
  2 y 4. Seguir el patrón de tests puros existentes (p. ej.
  `__tests__/resolveProfileConfig.test.ts`: describe por función, casos con
  nombre en español).
- `npm test` completo → verde, con ≥6 tests nuevos.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0; existen y pasan los tests de rango DST (primavera y
      otoño) y los de `addDaysISO`
- [ ] `grep -n "toISOString" mcm-app/hooks/useCalendarEvents.ts` → sin
      resultados en el bucle de expansión (puede quedar en otros usos si los
      hubiera, pero no en este)
- [ ] `grep -n "setDate(" mcm-app/hooks/useCalendarEvents.ts` → sin resultados
- [ ] Parte B: o bien el código normaliza `Z`/`TZID` con sus tests, o bien la
      fila del README documenta que el feed real no lo necesita
- [ ] `git status` limpio fuera del scope
- [ ] `plans/README.md` actualizado
- [ ] Entrada en `mcm-app/CHANGELOG.md` (bug de datos visibles: SÍ se documenta)

## STOP conditions

Stop and report back (do not improvise) if:

- El código no coincide con los excerpts (drift — p. ej. si [PERF-01] se
  ejecutó antes y reescribió el fetch).
- El feed real no es accesible desde el entorno (sin red) → completar solo la
  parte A y dejar B como BLOCKED con esa razón.
- Aparece una `TZID` que no sea `Europe/Madrid` en el feed real.
- Algún consumidor depende de las claves duplicadas actuales (no debería —
  si un test de pantalla existente se rompe, parar).

## Maintenance notes

- Si algún día se añade soporte de `RRULE` (recurrencias — hoy el parser las
  ignora), reutilizar `addDaysISO`/la normalización de este plan; no volver a
  `Date`+`setDate`.
- Revisor: vigilar que la parte B no convierta valores flotantes — es la
  manera de romper feeds que hoy funcionan.
- Relacionado, deliberadamente fuera: descarga serial y sin TTL de los ICS
  ([PERF-01]); `SUMMARY` con `\,` sin des-escapar si no se incluyó.
