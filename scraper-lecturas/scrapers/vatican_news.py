"""
Scraper for Vatican News daily gospel pages — commentary only.
https://www.vaticannews.va/es/evangelio-de-hoy/{YYYY}/{MM}/{DD}.html

This scraper fetches per-date HTML pages and extracts ONLY the
"Las palabras de los Papas" section.  It does NOT extract gospel texts,
readings, or salmo — those come from dominicos.py.

For each date:
  • comentario    ← body of the "Las palabras de los Papas" section
  • comentarista  ← author extracted from the trailing parenthetical

Pages without a recognisable "Palabras" section are skipped (WARNING logged).

HTML structure (verified 2026-04-12):
  <section class="section section--evidence section--isStatic">
    <div class="section__head">
      <h2>Las palabras de los Papas</h2>
    </div>
    <div class="section__wrapper">
      <div class="section__content">
        <p>Commentary paragraph…</p>
        <p>(Francisco - Regina caeli, 16 de abril de 2023)</p>
      </div>
    </div>
  </section>

Default date range: today+1 … today+14 (future dates only).
Past dates' commentary is already in Firebase and VidaNueva overwrites
today anyway, so past scraping is unnecessary.
"""

import logging
import re
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, EvangelioData
from utils.date_utils import date_range_iso
from utils.text_utils import join_paragraphs

log = logging.getLogger(__name__)

BASE_URL = "https://www.vaticannews.va/es/evangelio-de-hoy"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Referer": "https://www.vaticannews.va/",
}

RETRY_DELAYS = [5, 15]   # seconds between HTTP retries
REQUEST_SLEEP = 0.5       # polite delay between date requests

# Case-insensitive patterns that identify the "palabras de los Papas" section.
_PAPAS_PATTERNS = (
    "las palabras de los papas",
    "las palabras del papa",
    "palabras del papa",
    "reflexión del papa",
    "reflexion del papa",
)


class VaticanNewsScraper(BaseScraper):

    SOURCE_KEY = "vaticanNews"
    SOURCE_URL = BASE_URL
    REQUIRED_FIELDS = ("comentario", "comentarista")
    WRITES_NODES = frozenset({"evangelio"})

    def __init__(self, fechas: list[str] | None = None) -> None:
        """
        Parameters
        ----------
        fechas:
            Explicit list of YYYY-MM-DD to scrape.
            Default: today(Madrid)+1 … today+14 (next 14 days).
        """
        self._fechas: list[str] = fechas if fechas is not None else date_range_iso(1, 14)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fetch(self) -> list[EvangelioData]:
        results: list[EvangelioData] = []
        for i, fecha in enumerate(self._fechas):
            data = self._fetch_one(fecha)
            if data is not None:
                results.append(data)
            if i < len(self._fechas) - 1:
                time.sleep(REQUEST_SLEEP)

        log.info(
            f"[VaticanNews] {len(results)}/{len(self._fechas)} fechas "
            "con sección 'Palabras de los Papas'"
        )
        return results

    # ------------------------------------------------------------------
    # Per-date fetch
    # ------------------------------------------------------------------

    def _fetch_one(self, fecha_iso: str) -> EvangelioData | None:
        d = datetime.strptime(fecha_iso, "%Y-%m-%d")
        url = f"{BASE_URL}/{d.year}/{d.month:02d}/{d.day:02d}.html"

        html = self._get_html(url, fecha_iso)
        if html is None:
            return None

        return self._parse_page(html, url, fecha_iso)

    def _get_html(self, url: str, fecha_iso: str) -> str | None:
        session = requests.Session()
        for attempt, delay in enumerate(RETRY_DELAYS, start=1):
            try:
                log.info(
                    f"[VaticanNews] {fecha_iso} intento {attempt}/{len(RETRY_DELAYS) + 1}"
                    f" → {url}"
                )
                resp = session.get(url, headers=HEADERS, timeout=15)
                if resp.status_code == 200:
                    log.info(f"[VaticanNews] {fecha_iso} OK ({len(resp.content)} bytes)")
                    return resp.text
                if resp.status_code == 404:
                    log.warning(f"[VaticanNews] {fecha_iso}: 404 — página no publicada aún")
                    return None
                log.warning(
                    f"[VaticanNews] {fecha_iso}: HTTP {resp.status_code} en intento {attempt}"
                )
            except requests.RequestException as e:
                log.warning(f"[VaticanNews] {fecha_iso}: error de red en intento {attempt}: {e}")
            if attempt <= len(RETRY_DELAYS):
                time.sleep(delay)

        log.error(f"[VaticanNews] {fecha_iso}: todos los intentos fallaron")
        return None

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------

    def _parse_page(self, html: str, url: str, fecha_iso: str) -> EvangelioData | None:
        soup = BeautifulSoup(html, "lxml")
        result = self._extract_palabras_papas(soup)
        if result is None:
            log.warning(
                f"[VaticanNews] {fecha_iso}: no se encontró sección "
                "'Las palabras de los Papas' en la página"
            )
            return None

        data = EvangelioData(url=url, fecha=fecha_iso)
        data.comentario, data.comentarista = result
        return data

    def _extract_palabras_papas(self, soup: BeautifulSoup) -> tuple[str, str] | None:
        """
        Find the evidence section whose <h2> matches a papas pattern and
        extract (comentario_text, comentarista).

        Walks <section class="section--evidence"> elements; the heading is
        inside <div class="section__head"> and content in
        <div class="section__content">.

        Returns None if no matching section is found or content is empty.
        """
        for section in soup.select("section.section--evidence"):
            h2 = section.select_one(".section__head h2")
            if h2 is None:
                continue
            h2_text = h2.get_text(" ", strip=True).lower()
            if not any(pat in h2_text for pat in _PAPAS_PATTERNS):
                continue

            content_div = section.select_one(".section__content")
            if content_div is None:
                continue

            paras = [
                p.get_text(" ", strip=True)
                for p in content_div.find_all("p")
                if p.get_text(strip=True)
            ]
            if not paras:
                return None

            comentario = join_paragraphs(paras)
            comentarista = _extract_author(paras[-1])
            return comentario, comentarista

        return None


# ---------------------------------------------------------------------------
# Author extraction helper
# ---------------------------------------------------------------------------

_AUTHOR_RE = re.compile(r"\(([^)]+)\)\s*$")


def _extract_author(last_paragraph: str) -> str:
    """
    Extract the author name from the trailing parenthetical of a commentary.

    "(Benedicto XVI - Audiencia general, 14 de abril de 2010)"  → "Benedicto XVI"
    "(Francisco, Homilía Vigilia Pascual, 19 de abril de 2014)" → "Francisco"
    No match → "Vatican News"
    """
    match = _AUTHOR_RE.search(last_paragraph)
    if not match:
        return "Vatican News"

    inner = match.group(1).strip()

    if " - " in inner:
        return inner.split(" - ")[0].strip()
    if "," in inner:
        return inner.split(",")[0].strip()
    return inner
