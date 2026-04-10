# scrapping-lecturas

Scraper diario que extrae el comentario del Evangelio del día de fuentes externas y lo guarda en Firebase Realtime Database.

Se ejecuta automáticamente cada día a las **00:05 UTC** vía GitHub Actions, y puede lanzarse manualmente desde la pestaña Actions del repositorio.

## Estructura Firebase

```
seccion_oracion/
  lecturas/
    YYYY-MM-DD/
      evangelio/
        activo: "vidaNueva"              ← fuente preferida (para el frontend)
        vidaNuevaComentario: "..."
        vidaNuevaComentarista: "..."
        vidaNuevaCita: "Juan 7,40-53"
        vidaNuevaEvangelioTexto: "..."
        vidaNuevaTitulo: "..."
        vidaNuevaPrimeraLectura: "..."
        vidaNuevaSalmo: "..."
        vidaNuevaSantos: "..."
        vidaNuevaURL: "https://..."
        vidaNuevaLastUpdated: "2026-03-21T00:07:33Z"
```

## Fuentes implementadas

| Fuente | URL | Hora publicación | Estado |
|--------|-----|-----------------|--------|
| Vida Nueva | https://www.vidanuevadigital.com/evangeliodeldia/ | ~00:00 UTC | ✅ Activa |

## Instalación local

```bash
cd scrapping-lecturas
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env            # rellenar credenciales
```

### Credenciales necesarias en `.env`

| Variable | Descripción |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo de una service account de Firebase (Admin SDK) |
| `FIREBASE_DATABASE_URL` | URL de la Realtime Database (ej. `https://proyecto-rtdb.europe-west1.firebasedatabase.app`) |

Para obtener el service account: Firebase Console → Project Settings → Service Accounts → "Generate new private key".

## Uso

```bash
# Scrape de hoy y guardar en Firebase
python main.py

# Scrape de una fecha específica (backfill)
python main.py --date 2026-03-15

# Probar sin escribir en Firebase
python main.py --dry-run

# Tests (usan el snapshot HTML del repositorio, sin red)
pytest tests/ -v
```

## GitHub Actions

El workflow `.github/workflows/scraper-lecturas.yml` se ejecuta:
- **Automáticamente** a las 00:05 UTC cada día
- **Manualmente** desde Actions → "Scraper Lecturas Diario" → "Run workflow"
  - Parámetro opcional `date` (YYYY-MM-DD) para hacer backfill

### Secrets de GitHub necesarios

| Secret | Descripción |
|--------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Nuevo** — JSON del service account (igual que `.env`) |
| `EXPO_PUBLIC_FIREBASE_DATABASE_URL` | Ya existe en el repo — se reutiliza |

## Añadir una nueva fuente

1. Crear `scrapers/mi_fuente.py` heredando de `BaseScraper`:
   ```python
   from scrapers.base import BaseScraper, EvangelioData

   class MiFuenteScraper(BaseScraper):
       SOURCE_KEY = "miFuente"   # prefijo para campos Firebase
       SOURCE_URL = "https://..."

       def fetch(self) -> EvangelioData:
           # ... scraping logic ...
   ```
2. Registrar en `main.py`:
   ```python
   SCRAPERS = [
       VidaNuevaScraper(),
       MiFuenteScraper(),   # ← añadir aquí
   ]
   ```
3. Los campos de la nueva fuente (`miFuenteComentario`, `miFuenteCita`, etc.) se escriben automáticamente al mismo nodo de Firebase con `ref.update()`, sin sobreescribir los de Vida Nueva.

## Nota sobre IP blocking

El site vidanuevadigital.com puede bloquear IPs de cloud (Azure/GitHub). Si el workflow falla con HTTP 403:
- Se registra `vidaNuevaError: "HTTP_FETCH_FAILED"` en Firebase
- Los logs de GitHub Actions mostrarán `x-deny-reason: host_not_allowed`

Soluciones si el bloqueo persiste:
- **Opción A**: Self-hosted runner con IP residencial (Raspberry Pi, VPS en casa)
- **Opción B**: Proxy residencial (servicio externo ~$5/mes)
