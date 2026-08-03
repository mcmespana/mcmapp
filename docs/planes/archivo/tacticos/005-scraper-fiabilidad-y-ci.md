# Plan 005: Scraper de lecturas — fallar cuando no hay datos, vetar fechas inválidas, tests en CI y workflow sin inyección

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d2822c..HEAD -- scraper-lecturas/ .github/workflows/scraper-lecturas.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug + security + tests (scraper)
- **Planned at**: commit `2d2822c`, 2026-07-18

## Why this matters

El scraper alimenta la sección de oración diaria (Contigo). Cuatro problemas
verificados:

1. **Éxito silencioso con cero datos**: si dominicos.org o Vatican News
   cambian su HTML y el scraper devuelve lista vacía, el proceso sale con 0,
   la Action queda verde y la app se queda sin lecturas nuevas sin que nadie
   lo sepa (hasta 30 días, cuando el cleanup vacía todo).
2. **Fecha `unknown`**: si VidaNueva cambia el formato de fecha, la lectura
   real de hoy se escribe bajo la clave `unknown` — la app no la ve y el
   cleanup (que solo borra claves `YYYY-MM-DD`) nunca reclama ese nodo.
3. **Los tests no corren en ningún CI y ya hay uno en rojo**:
   `test_evangelio_payload_keys` asserta una clave `activo` que el código ya
   no produce (`activoTexto`/`activoComentario` desde el refactor) — nadie se
   enteró porque no hay paso de pytest.
4. **Inyección de script en el workflow**: `${{ github.event.inputs.date }}`
   se interpola crudo dentro del bloque `run:` bash, en el mismo job que tiene
   `FIREBASE_SERVICE_ACCOUNT_JSON` (Admin SDK — ignora todas las reglas RTDB).
   Quien pueda disparar el workflow puede ejecutar comandos en el runner.

## Current state

- `scraper-lecturas/main.py:128-171` (`_run_one`, verificado): `errors` solo
  se incrementa dentro del `for data in data_list:`; con `data_list == []` el
  bucle no corre y devuelve `0`.
- `scraper-lecturas/main.py:229-237`:

  ```python
  def _exit_code(errors: int, total_scrapers: int) -> int:
      if errors == 0:
          log.info("Completado sin errores.")
          return 0
  ```

- `scraper-lecturas/scrapers/vida_nueva.py:127` — `EvangelioData(url=URL, fecha="unknown")`;
  `:146-151` — `except ValueError` solo hace `log.warning`, `fecha` queda
  `"unknown"`.
- `scraper-lecturas/scrapers/base.py:57-63` — `validate()` solo comprueba
  `REQUIRED_FIELDS` no vacíos; NO valida `fecha`.
- `scraper-lecturas/utils/cleanup.py:13` — `_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")`;
  solo se borran claves que matchean.
- `scraper-lecturas/scrapers/base.py:98-102` — el payload de evangelio produce
  `activoTexto`/`activoComentario`, nunca `activo`.
- `scraper-lecturas/tests/test_vida_nueva.py:113` — `assert payload["activo"] == "vidaNueva"`
  → KeyError hoy (test rojo).
- `.github/workflows/scraper-lecturas.yml:100-114` (job con
  `FIREBASE_SERVICE_ACCOUNT_JSON` en `env`):

  ```yaml
  run: |
    ARGS=""
    if [ -n "${{ github.event.inputs.date }}" ]; then
      ARGS="$ARGS --date ${{ github.event.inputs.date }}"
    fi
    ...
    python main.py $ARGS
  ```

  El input `date` (`:9-13`) es texto libre. Los otros tres inputs son
  `type: boolean` (riesgo menor, pero migra todos al mismo patrón env).
- Deps de test ya pineadas: `requirements-dev.txt` → `pytest==8.3.3`,
  `responses==0.25.3`, `pytest-cov==5.0.0`.
- No hay ningún paso `pytest` ni en `scraper-lecturas.yml` ni en
  `.github/workflows/ci.yml` (verificado).

## Commands you will need

| Purpose        | Command (desde `scraper-lecturas/`)        | Expected on success |
|----------------|---------------------------------------------|---------------------|
| Install (dev)  | `pip install -r requirements-dev.txt`       | exit 0              |
| Tests          | `python -m pytest tests/ -q`                | all pass            |
| Smoke (sin red)| `python -m pytest tests/ -q -k vida_nueva`  | all pass            |

## Scope

**In scope**:
- `scraper-lecturas/main.py`
- `scraper-lecturas/scrapers/vida_nueva.py`
- `scraper-lecturas/scrapers/base.py`
- `scraper-lecturas/tests/` (arreglar el rojo + añadir casos)
- `.github/workflows/scraper-lecturas.yml`
- `scraper-lecturas/README.md` (bloque de esquema con `activo` obsoleto)

**Out de scope**:
- Los parsers de dominicos/vatican_news en sí (la lógica de fallback fue
  robustecida en el commit 1008245 — no la toques).
- Validación de contenido/longitud de campos (hallazgo SCRAPER-03, plan aparte
  si se selecciona).
- `firebase/client.py` (lifecycle de credenciales verificado sano).
- `.github/workflows/ci.yml` (el pytest se añade al workflow del scraper,
  no al CI de la app).

## Git workflow

- Branch: `advisor/005-scraper-fiabilidad` desde `main`.
- Commits por paso: `fix(scraper-lecturas): ...` (estilo del commit 1008245).
- No push / no PR salvo que el operador lo pida.

## Steps

### Step 1: Arreglar el test rojo y el README

En `tests/test_vida_nueva.py:113` sustituye el assert de `activo` por:

```python
assert payload["activoTexto"] == "vidaNueva"
assert payload["activoComentario"] == "vidaNueva"
```

(coherente con `base.py:98-102`). Actualiza el bloque de esquema del
`README.md` del scraper que aún muestra `activo: "vidaNueva"`.

**Verify**: `python -m pytest tests/ -q` → all pass (baseline verde).

### Step 2: Lista vacía = error

En `main.py` `_run_one`, tras `data_list = scraper.fetch()`: si
`data_list` está vacío (o todos sus items son `None`), loguea
`log.error(f"[{name}] fetch() no devolvió ningún dato")` y devuelve `1`.
No cambies la semántica para runs `--cleanup-only` (comprueba cómo se invoca
`_run_one` en ese modo — si no se invoca, no hay conflicto).

**Verify**: test nuevo (Step 5) + `python -m pytest tests/ -q` → pass.

### Step 3: Vetar fechas no ISO antes de escribir

En `base.py` `validate()`, añade al final la comprobación de que
`data.fecha` matchea `^\d{4}-\d{2}-\d{2}$` (usa `re` local o importa el
patrón; no importes desde `utils/cleanup.py` si crea ciclos — duplicar el
regex de 1 línea con un comentario cruzado es aceptable aquí). Con esto una
`fecha="unknown"` cae en la rama de "Validación fallida" de `_run_one`, se
cuenta como error y NO se escribe.

**Verify**: `python -m pytest tests/ -q` → pass (ajusta fixtures si algún
test usaba fechas raras legítimas — si un fixture legítimo rompe, STOP).

### Step 4: Workflow — inputs vía `env` y paso de pytest

En `.github/workflows/scraper-lecturas.yml`:

1. En el step "Ejecutar scraper", añade al bloque `env:` existente:
   `INPUT_DATE: ${{ github.event.inputs.date }}`,
   `INPUT_DRY_RUN: ${{ github.event.inputs.dry_run }}`,
   `INPUT_BACKFILL: ${{ github.event.inputs.backfill_dominicos }}`,
   `INPUT_CLEANUP_ONLY: ${{ github.event.inputs.cleanup_only }}`.
2. Reescribe el script para referenciar SOLO las variables env (nunca `${{ }}`
   dentro del `run:`), citando `"$INPUT_DATE"`:

   ```bash
   ARGS=""
   if [ -n "$INPUT_DATE" ]; then ARGS="$ARGS --date $INPUT_DATE"; fi
   if [ "$INPUT_DRY_RUN" = "true" ]; then ARGS="$ARGS --dry-run"; fi
   ...
   python main.py $ARGS
   ```

3. Añade un step ANTES del scraper (después del pip install):

   ```yaml
   - name: Tests
     working-directory: scraper-lecturas
     run: |
       pip install -r requirements-dev.txt
       python -m pytest tests/ -q
   ```

**Verify**: `grep -c 'github.event.inputs' .github/workflows/scraper-lecturas.yml`
→ las únicas ocurrencias quedan dentro de bloques `env:` (ninguna dentro de
`run:`). YAML válido: `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/scraper-lecturas.yml'))"` → exit 0.

### Step 5: Tests nuevos de los pasos 2 y 3

En `tests/` añade (fixtures mínimos, patrón de los tests existentes con
`responses`):
- `test_empty_fetch_counts_as_error`: scraper stub cuyo `fetch()` devuelve
  `[]` → `_run_one(...)` devuelve ≥1.
- `test_unknown_fecha_rejected`: `EvangelioData` válido salvo
  `fecha="unknown"` → `validate()` False.
- `test_valid_iso_fecha_passes`: mismo dato con `fecha="2026-07-18"` →
  `validate()` True.

**Verify**: `python -m pytest tests/ -q` → all pass, ≥3 tests nuevos.

## Test plan

Cubierto en Steps 1 y 5. La suite entera debe quedar verde y ejecutándose en
el workflow (Step 4.3) — esa es la corrección estructural: los tests del
scraper pasan a ser un gate real.

## Done criteria

- [ ] `python -m pytest tests/ -q` exit 0 (incluye el test antes rojo, ya arreglado, y ≥3 nuevos)
- [ ] `_run_one` devuelve ≥1 con `fetch()` vacío (test lo demuestra)
- [ ] `validate()` rechaza `fecha` no ISO (test lo demuestra)
- [ ] Ninguna expansión `${{ github.event.inputs.* }}` dentro de bloques `run:` del workflow
- [ ] El workflow tiene paso de pytest antes de ejecutar el scraper
- [ ] `git status` limpio fuera del scope; fila en `plans/README.md` actualizada
      (el CHANGELOG de mcm-app no aplica — esto es el scraper)

## STOP conditions

- Los excerpts no coinciden (drift), en especial si alguien tocó `_run_one`
  o `validate()` desde el commit 1008245.
- Al añadir la validación de fecha, algún fixture LEGÍTIMO de dominicos o
  vatican_news deja de pasar (significaría que hay flujos reales con fechas
  no ISO) — reporta antes de tocar los parsers.
- El modo `--cleanup-only` o `--backfill-dominicos` invoca `_run_one` con
  semántica distinta que rompa el Step 2 — reporta.
- No puedes validar el YAML del workflow localmente — igualmente NO lo
  despliegues a mano; el push del branch no dispara este workflow (solo
  `schedule` y `workflow_dispatch`), así que déjalo para review humana.

## Maintenance notes

- Al añadir un scraper nuevo, heredará el gate "vacío = error" y la
  validación de `fecha` — si un scraper legítimamente puede devolver vacío
  (p.ej. fuente que publica solo domingos), parametrizarlo explícitamente.
- Revisar en la primera ejecución real post-merge que la Action falla como
  se espera si se simula un HTML roto (se puede probar con
  `workflow_dispatch` + `dry_run=true`).
- Si el repo tiene colaboradores externos con permiso de dispatch, rotar el
  service account de Firebase es recomendable dado el patrón de inyección
  que existía (tipo de credencial: clave de service account de Firebase
  Admin en el secret `FIREBASE_SERVICE_ACCOUNT_JSON`).
