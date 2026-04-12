"""
Scraper for https://www.dominicos.org/predicacion/

Fetches reading texts (lectura1, lectura2 optional, salmo, evangelio) for a
list of future dates WITHOUT commentary.  Commentary comes from other sources.

URL patterns
------------
Weekday:  /predicacion/evangelio-del-dia/{D}-{M}-{YYYY}/
Sunday:   /predicacion/homilia/{D}-{M}-{YYYY}/lecturas/

Strategy: always try the weekday URL first.  A 404 response means the day uses
the Sunday/feast URL (which also applies to non-Sunday liturgical feasts that
happen on weekdays).  Both 404 → skip date silently + log WARN.

Date format: no zero-padding on day or month (Python int → str is enough).
"""

import logging
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from firebase.client import get_existing_dominicos_dates
from scrapers.base import BaseScraper, EvangelioData
from utils.citations import (
    normalize_whitespace,
    strip_body_boilerplate,
    strip_reading_prefix,
    strip_salmo_response,
)
from utils.date_utils import date_range_iso, today_madrid_iso
from utils.text_utils import join_paragraphs

log = logging.getLogger(__name__)

BASE_URL = "https://www.dominicos.org"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9",
    "Referer": "https://www.dominicos.org/",
}

RETRY_DELAYS = [5, 15]   # seconds between HTTP retries
REQUEST_SLEEP = 0.7       # polite delay between date requests


class DominicosScraper(BaseScraper):

    SOURCE_KEY = "dominicos"
    SOURCE_URL = BASE_URL
    REQUIRED_FIELDS = ("cita", "evangelio_texto")
    WRITES_NODES = frozenset({"evangelio", "lectura1", "lectura2", "salmo", "info"})

    def __init__(
        self,
        fechas: list[str] | None = None,
        *,
        skip_existing: bool = True,
    ) -> None:
        """
        Parameters
        ----------
        fechas:
            Explicit list of YYYY-MM-DD to scrape.
            Default: today(Madrid) .. today+30 (31 dates).
        skip_existing:
            If True, check Firebase before fetching and skip dates where
            dominicosLastUpdated already exists.  Set False for backfill.
        """
        self._fechas: list[str] = fechas if fechas is not None else date_range_iso(0, 30)
        self._skip_existing = skip_existing

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fetch(self) -> list[EvangelioData]:
        fechas_to_fetch = list(self._fechas)

        if self._skip_existing:
            try:
                already_done = get_existing_dominicos_dates(fechas_to_fetch)
            except Exception as e:
                log.warning(
                    f"[Dominicos] No se pudo comprobar fechas existentes ({e}). "
                    "Procesando todas."
                )
                already_done = set()

            if already_done:
                sample = sorted(already_done)[:3]
                log.info(
                    f"[Dominicos] Saltando {len(already_done)} fechas ya procesadas "
                    f"(ej. {sample}{'...' if len(already_done) > 3 else ''})"
                )
            fechas_to_fetch = [f for f in fechas_to_fetch if f not in already_done]

        log.info(f"[Dominicos] Procesando {len(fechas_to_fetch)} fechas")

        results: list[EvangelioData] = []
        for i, fecha in enumerate(fechas_to_fetch):
            data = self._fetch_one(fecha)
            if data is not None:
                results.append(data)
            if i < len(fechas_to_fetch) - 1:
                time.sleep(REQUEST_SLEEP)

        log.info(f"[Dominicos] {len(results)}/{len(fechas_to_fetch)} fechas extraídas con éxito")
        return results

    # ------------------------------------------------------------------
    # URL building
    # ------------------------------------------------------------------

    @staticmethod
    def _weekday_url(fecha_iso: str) -> str:
        d = datetime.strptime(fecha_iso, "%Y-%m-%d")
        return f"{BASE_URL}/predicacion/evangelio-del-dia/{d.day}-{d.month}-{d.year}/"

    @staticmethod
    def _sunday_url(fecha_iso: str) -> str:
        d = datetime.strptime(fecha_iso, "%Y-%m-%d")
        return f"{BASE_URL}/predicacion/homilia/{d.day}-{d.month}-{d.year}/lecturas/"

    # ------------------------------------------------------------------
    # HTTP
    # ------------------------------------------------------------------

    def _fetch_one(self, fecha_iso: str) -> EvangelioData | None:
        """
        Try weekday URL first.  Falls back to Sunday URL when:
        - weekday URL returns 404, OR
        - weekday URL returns 200 but contains no reading blocks
          (happens on Sundays: the page is an intro/tab page without texts).

        Both URLs fail → log WARN, return None (caller skips this date).
        Network errors → log ERROR, return None.
        """
        weekday_url = self._weekday_url(fecha_iso)
        html, final_url = self._get_html(weekday_url)

        if html is not None:
            data = self._parse_page(html, final_url, fecha_iso)
            # Sanity check: real reading pages always have Primera lectura + Evangelio.
            # Sunday intro pages may have an h2 "Evangelio del día" that produces a
            # false evangelio block with garbage text, so cita/evangelio_texto alone
            # is not enough — also require primera_lectura.
            if data.cita and data.evangelio_texto and data.primera_lectura:
                return data
            # Page returned 200 but no real readings found → try Sunday URL
            log.info(
                f"[Dominicos] {fecha_iso}: weekday URL devolvió 200 sin lecturas completas, "
                f"probando URL de domingo…"
            )
        elif final_url != "404":
            log.error(
                f"[Dominicos] {fecha_iso}: fallo de red en {weekday_url}"
            )
            return None

        # Try Sunday/feast URL
        sunday_url = self._sunday_url(fecha_iso)
        html, final_url = self._get_html(sunday_url)

        if html is None:
            if final_url == "404":
                log.warning(
                    f"[Dominicos] {fecha_iso}: ambas URLs sin lecturas.\n"
                    f"  weekday: {weekday_url}\n"
                    f"  sunday:  {sunday_url}"
                )
            else:
                log.error(
                    f"[Dominicos] {fecha_iso}: fallo de red en {sunday_url}"
                )
            return None

        data = self._parse_page(html, final_url, fecha_iso)
        if not data.cita and not data.evangelio_texto:
            log.warning(
                f"[Dominicos] {fecha_iso}: ambas URLs devolvieron HTML "
                f"pero no se encontraron lecturas. "
                f"Posible cambio en la estructura del DOM.\n"
                f"  weekday: {weekday_url}\n"
                f"  sunday:  {sunday_url}"
            )
            return None
        return data

    def _get_html(self, url: str) -> tuple[str | None, str]:
        """
        GET *url* with retries.

        Returns (html_text, url) on success.
        Returns (None, "404") on HTTP 404.
        Returns (None, url) on other failures.
        """
        session = requests.Session()
        for attempt, delay in enumerate(RETRY_DELAYS, start=1):
            try:
                resp = session.get(url, headers=HEADERS, timeout=15)
                if resp.status_code == 200:
                    return resp.text, url
                if resp.status_code == 404:
                    return None, "404"
                if resp.status_code == 429:
                    wait = int(resp.headers.get("Retry-After", 30))
                    log.warning(f"[Dominicos] 429 Rate-limited. Esperando {wait}s…")
                    time.sleep(wait)
                    continue
                log.warning(f"[Dominicos] HTTP {resp.status_code} en intento {attempt}: {url}")
            except requests.RequestException as e:
                log.warning(f"[Dominicos] Error de red en intento {attempt}: {e}")
            if attempt < len(RETRY_DELAYS):
                time.sleep(delay)

        return None, url

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------

    def _parse_page(self, html: str, url: str, fecha_iso: str) -> EvangelioData:
        soup = BeautifulSoup(html, "lxml")
        data = EvangelioData(url=url, fecha=fecha_iso)

        blocks = self._extract_blocks(soup)

        # --- Evangelio ---
        if "evangelio" in blocks:
            cita_raw, body = blocks["evangelio"]
            data.cita = strip_reading_prefix(cita_raw)
            data.evangelio_texto = body or None
        else:
            log.warning(f"[Dominicos] {fecha_iso}: no se encontró bloque evangelio")

        # --- Primera lectura ---
        if "lectura1" in blocks:
            cita_raw, body = blocks["lectura1"]
            data.primera_lectura = strip_reading_prefix(cita_raw)
            data.primera_lectura_texto = body or None

        # --- Segunda lectura (optional) ---
        if "lectura2" in blocks:
            cita_raw, body = blocks["lectura2"]
            data.segunda_lectura = strip_reading_prefix(cita_raw)
            data.segunda_lectura_texto = body or None

        # --- Salmo ---
        if "salmo" in blocks:
            cita_raw, body = blocks["salmo"]
            data.salmo = strip_salmo_response(cita_raw)
            data.salmo_texto = body or None

        return data

    def _extract_blocks(self, soup: BeautifulSoup) -> dict[str, tuple[str, str]]:
        """
        Search the main content area for reading blocks.

        Returns a dict:
            {
                "lectura1":  (cita_raw, body_text),
                "salmo":     (cita_raw, body_text),
                "lectura2":  (cita_raw, body_text),   # optional
                "evangelio": (cita_raw, body_text),
            }

        Handles three HTML layouts seen on dominicos.org:

        Layout A (old) — h2 sections + h3 citations inside div.contenido-homilia:
            <h2>Primera lectura</h2>
            <h3>Lectura del libro de los Hechos…</h3>
            <p>En aquellos días…</p>

        Layout B (2026) — h3 sections + h4 citations:
            <h3>Primera lectura</h3>
            <h4>Lectura del libro de los Hechos…</h4>
            <p>En aquellos días…</p>

        Layout C — bold paragraphs:
            <p><strong>PRIMERA LECTURA</strong></p>
            <p><em>Lectura del libro de los Hechos…</em></p>
            <p>En aquellos días…</p>

        Uses find_all() to search at any depth (not just direct children),
        making the parser resilient to container class changes.
        """
        content = self._find_content_root(soup)

        # Collect all potentially relevant elements in document order.
        elements = content.find_all(["h2", "h3", "h4", "p"])

        blocks: dict[str, tuple[str, str]] = {}
        current_section: str | None = None
        current_cita_raw: str | None = None
        current_body_paras: list[str] = []

        def flush() -> None:
            if current_section and current_cita_raw is not None:
                body_text = strip_body_boilerplate(join_paragraphs(current_body_paras))
                blocks[current_section] = (current_cita_raw, body_text)

        for el in elements:
            tag = el.name.lower()
            text = el.get_text(" ", strip=True)
            if not text:
                continue

            # --- Check if this element is a reading section header ---
            section = _classify_section(tag, text, el)
            if section:
                flush()
                current_section = section
                current_body_paras = []
                # Pattern C: heading already contains inline <em> citation
                em = el.find("em") or el.find("i")
                current_cita_raw = em.get_text(" ", strip=True) if em else None
                continue

            # --- Non-reading h2/h3 after we started → stop current section ---
            if tag in ("h2", "h3") and current_section is not None:
                if current_cita_raw is not None:
                    # We already have citation + body → this heading ends the section
                    flush()
                    current_section = None
                    current_cita_raw = None
                    current_body_paras = []
                    continue
                # No citation yet → this h3 IS the citation (Layout A: h2 section + h3 cite)
                current_cita_raw = text
                continue

            if current_section is None:
                continue  # Before first section header

            # --- Citation detection ---
            if current_cita_raw is None:
                if tag == "h4":
                    # Layout B: h4 is the citation heading
                    current_cita_raw = text
                elif tag == "p":
                    em = el.find("em") or el.find("i")
                    current_cita_raw = (
                        em.get_text(" ", strip=True) if em else normalize_whitespace(text)
                    )
                continue

            # --- Body text ---
            if tag == "p":
                para = normalize_whitespace(text)
                if para:
                    current_body_paras.append(para)

        flush()
        return blocks

    @staticmethod
    def _find_content_root(soup: BeautifulSoup):
        """
        Locate the main article content element.
        Tries multiple selectors in order of specificity.

        Since _extract_blocks uses find_all() (not .children), the content
        root does not need to be the *direct* parent of the headings — any
        ancestor works.  We just need to narrow enough to avoid picking up
        sidebar/footer headings.
        """
        for selector in [
            "div.contenido-homilia",   # dominicos.org (old layout)
            "div.contenido-dia",       # dominicos.org (analysis doc)
            "div.contenido-pred",       # outer wrapper
            "section.contenido",        # broader section wrapper
            "div.field--name-body",
            "div.entry-content",
            "article .content",
            "main article",
            "article",
            "main",
        ]:
            el = soup.select_one(selector)
            if el:
                return el
        return soup.find("body") or soup


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Keywords that mark a heading as NON-reading content (should be ignored).
_STOP_KEYWORDS = frozenset({
    "VÍDEO", "VIDEO", "AUDIO", "REFLEXIÓN", "REFLEXION",
    "SUSCRIPCIÓN", "SUSCRIPCION", "RECIBA", "COMENTARIO",
    "Y LECTURAS", "PAUTAS",
})


def _classify_section(tag: str, text: str, el) -> str | None:
    """
    Return the section key ("lectura1", "lectura2", "salmo", "evangelio")
    if *el* looks like a section header, else None.

    Headings are detected by:
    - HTML heading tags (h1–h5) whose text is SHORT and contains NO DIGITS.
      This distinguishes section headers ("Salmo", "Primera lectura")
      from citation headings ("Salmo 41, 2-3; 42, 3. 4 R/. …" or
      "Lectura del santo evangelio según san Juan 3, 7-15").
    - Short <p> elements whose primary content is a <strong>/<b> label.
    """
    strong = el.find("strong") or el.find("b")
    is_bold_para = (
        tag == "p"
        and strong is not None
        and len(text) < 80  # headings are short
    )
    is_heading = (
        tag in ("h1", "h2", "h3", "h4", "h5")
        and len(text) < 60
        and not any(c.isdigit() for c in text)
    )

    if not (is_heading or is_bold_para):
        return None

    t = text.upper()

    # Exclude non-reading headings (video, audio, reflection, page titles…)
    if any(kw in t for kw in _STOP_KEYWORDS):
        return None

    if "PRIMERA LECTURA" in t or "1ª LECTURA" in t:
        return "lectura1"
    if "SEGUNDA LECTURA" in t or "2ª LECTURA" in t:
        return "lectura2"
    if "SALMO" in t:
        return "salmo"
    if "EVANGELIO" in t or ("PASIÓN" in t and "SEÑOR" in t):
        return "evangelio"
    return None
