# Plan 013: El scraper deja de gritar "TODAS las fuentes fallaron" cuando fallan tres fechas de una

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- scraper-lecturas/main.py scraper-lecturas/tests/`
> On a mismatch with the "Current state" excerpts, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW — cambio de reporting/exit code; las escrituras no se tocan
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

`_run_one` devuelve un contador de errores **por fecha** (un scraper procesa
~31 fechas y suma 1 por cada validación o escritura fallida), pero
`_exit_code` compara esa suma con el **número de scrapers**: con 3 scrapers,
tres fechas malas de UNA sola fuente (rutinario: Dominicos aún no publica
fechas futuras) producen `errors >= 3` → exit 2 y el summary rojo "❌
Fallaron TODAS las fuentes", aunque VaticanNews y VidaNueva hayan escrito
todo. La alerta pierde toda la señal: un apagón total y un hipo trivial son
indistinguibles, justo cuando `useDailyReadings` en la app empieza a servir
huecos. El arreglo: unidades coherentes — el exit code se deriva de cuántos
SCRAPERS no produjeron nada, y los errores por fecha quedan como éxito
parcial.

## Current state

- `scraper-lecturas/main.py` — orquestador (corre en GitHub Actions cada
  noche). Piezas:

```python
scrapers = build_scrapers(backfill_dominicos=backfill_dominicos, target_date=target_date)
results = [(s.__class__.__name__, _run_one(s, dry_run=dry_run)) for s in scrapers]   # l.126
errors = sum(n for _, n in results)                                                  # l.127 ← suma POR FECHA
# …
exit_code = _exit_code(errors, len(scrapers))                                        # l.133 ← comparada con Nº SCRAPERS
```

```python
def _run_one(scraper: BaseScraper, *, dry_run: bool) -> int:                # l.146
    """Run a single scraper and write results. Returns error count."""
    errors = 0
    try:
        data_list = scraper.fetch()
    except Exception as e:
        log.error(...); return 1          # fetch caído → 1 (aquí sí es "el scraper falló")
    if not any(data is not None for data in data_list):
        log.error(f"[{name}] fetch() no devolvió ningún dato"); return 1
    for data in data_list:                # ~31 fechas
        if not scraper.validate(data):
            errors += 1; continue          # ← +1 POR FECHA
        try:
            _write_nodes(...)
        except Exception:
            errors += 1                    # ← +1 POR FECHA
    return errors
```

```python
def _exit_code(errors: int, total_scrapers: int) -> int:                    # l.249-257
    if errors == 0: return 0
    if errors < total_scrapers:
        log.warning(f"{errors}/{total_scrapers} scrapers fallaron (éxito parcial)."); return 1
    log.error("TODOS los scrapers fallaron."); return 2
```

- El summary de Actions (`_build_summary_markdown`, ~l.284-289) renderiza el
  caso exit-2 como "❌ Fallaron TODAS las fuentes".
- Hay pytest en CI para el scraper (añadido en el plan táctico 005, ver
  `scraper-lecturas/tests/`) — mirar su estructura y añadir ahí.
- Convenciones: logs y docstrings en español/mixto como el archivo actual;
  no tocar los WRITERS.

## Commands you will need

| Purpose | Command (desde `scraper-lecturas/`) | Expected on success |
|---------|--------------------------------------|---------------------|
| Install | `pip install -r requirements.txt` (si el entorno no lo tiene) | exit 0 |
| Tests   | `python -m pytest tests/ -q`         | all pass            |
| Sintaxis| `python -m py_compile main.py`       | exit 0              |

## Scope

**In scope**:

- `scraper-lecturas/main.py` (`_run_one`, la agregación, `_exit_code`,
  `_build_summary_markdown` en lo que muestre el estado global)
- `scraper-lecturas/tests/` (test nuevo para la agregación)

**Out de scope** (do NOT touch):

- `scraper-lecturas/scrapers/*` — los scrapers en sí.
- `_write_nodes` / WRITERS / cleanup — las escrituras no cambian.
- El workflow de Actions — el contrato es el exit code, que se mantiene
  0/1/2; solo cambia CUÁNDO se emite cada uno.

## Git workflow

- Branch: la que indique el operador (o `advisor/013-scraper-exit-code-semantics`).
- Estilo: `fix(scraper): el exit code distingue fuente caída de fechas sueltas fallidas`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `_run_one` devuelve un resultado estructurado

Cambiar el retorno de `int` a un `NamedTuple` (o dataclass):

```python
class ScraperResult(NamedTuple):
    date_errors: int      # fechas con validación/escritura fallida
    wrote_any: bool       # ¿escribió al menos una fecha? (en dry_run: ¿habría escrito?)
```

- fetch caído o `data_list` vacío → `ScraperResult(date_errors=1, wrote_any=False)`
  (la fuente entera no produjo nada).
- El bucle cuenta `date_errors` como hoy y marca `wrote_any=True` en la
  primera escritura que no lance (en `dry_run`, en la primera validación OK —
  mirar qué hace `_write_nodes` con dry_run y ser consistente).

Actualizar `results` y los sitios que consumen `(name, n)` — incluido
`_build_summary_markdown` si desestructura los pares.

**Verify**: `python -m py_compile main.py` → exit 0.

### Step 2: agregación y `_exit_code` en unidades de scraper

```python
dead_scrapers = sum(1 for _, r in results if not r.wrote_any)
date_errors  = sum(r.date_errors for _, r in results)
exit_code = _exit_code(dead_scrapers, date_errors, len(scrapers))
```

Nueva semántica de `_exit_code(dead, date_errors, total)`:

- `dead == total` → 2, "TODOS los scrapers fallaron" (ahora es verdad).
- `dead > 0` o `date_errors > 0` → 1, éxito parcial con el detalle
  (`log.warning(f"{dead}/{total} fuentes sin datos; {date_errors} fechas con errores")`).
- todo cero → 0.

El summary de Actions refleja lo mismo: "❌ TODAS las fuentes" solo con
`dead == total`; si no, "⚠️ parcial" con el desglose por fuente
(nombre → fechas fallidas / sin datos).

**Verify**: `python -m py_compile main.py` → exit 0.

### Step 3: tests de la agregación

En `scraper-lecturas/tests/` (siguiendo el estilo de los tests existentes),
testear `_exit_code` y, si es razonable con los fakes disponibles, la
agregación de `results`:

1. 3 scrapers, uno con 3 `date_errors` pero `wrote_any=True` → exit **1**
   (el caso que hoy da 2 — test de regresión del bug).
2. Los 3 con `wrote_any=False` → exit 2.
3. Todo limpio → exit 0.
4. 1 fuente muerta + 2 sanas → exit 1.

**Verify**: `python -m pytest tests/ -q` → all pass, incluidos los nuevos.

## Test plan

- Los 4 casos del Step 3; el 1 debe fallar contra el código viejo.

## Done criteria

- [ ] `python -m pytest tests/ -q` exits 0 con los tests nuevos
- [ ] `grep -n "errors < total_scrapers" scraper-lecturas/main.py` → sin
      resultados (la comparación de unidades mezcladas ya no existe)
- [ ] "TODOS los scrapers fallaron" solo es alcanzable con todas las fuentes
      sin datos (verificable leyendo `_exit_code` nuevo)
- [ ] `git status` limpio fuera del scope
- [ ] `plans/README.md` actualizado
- [ ] SIN entrada en `mcm-app/CHANGELOG.md` (es del scraper, no de la app;
      si el repo tuviera changelog del scraper, allí — no lo tiene)

## STOP conditions

- Los excerpts no coinciden (drift).
- El workflow de Actions resulta depender de exit 2 para algo más que
  pintarse rojo (p. ej. un paso de notificación condicionado) — mirar el
  workflow antes de cambiar semántica; si condiciona, alinear el cambio con
  ese consumo y reportarlo.
- `_build_summary_markdown` tiene más acoplamiento al formato `(name, int)`
  del que se puede adaptar sin reescribirlo entero.

## Maintenance notes

- Siguiente mejora natural (fuera de scope): distinguir en el summary las
  fechas FUTURAS no publicadas (esperable) de las fechas pasadas fallidas
  (real) — hoy ambas son `date_errors`.
- Revisor: comprobar que `dry_run` sigue reportando igual que antes en el
  caso feliz.
