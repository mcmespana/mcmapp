"""
Scraper for Vatican News RSS Feed — commentary only.
https://www.vaticannews.va/es/evangelio-de-hoy.rss.xml

This scraper extracts ONLY the "Las palabras de los Papas" section from each
RSS item.  It does NOT extract gospel texts, readings, or salmo — those come
from dominicos.py.

For each item:
  • comentario    ← body of the "Palabras de los Papas" section
  • comentarista  ← author extracted from the trailing parenthetical
  • fecha         ← derived from pubDate

Items without a recognisable "Palabras" section are silently skipped
(logged as WARNING so we can monitor match rates).
"""

import logging
import re
import time
from email.utils import parsedate_to_datetime

import requests
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, EvangelioData
from utils.text_utils import join_paragraphs

log = logging.getLogger(__name__)

RSS_URL = "https://www.vaticannews.va/es/evangelio-de-hoy.rss.xml"

HEADERS = {
    "Accept": "application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "User-Agent": "Mozilla/5.0 (compatible; LecturasScraper/2.0)",
}

RETRY_DELAYS = [5, 15]

# Case-insensitive patterns that identify the "palabras de los Papas" heading.
_PAPAS_PATTERNS = (
    "las palabras de los papas",
    "las palabras del papa",
    "palabras del papa",
    "reflexión del papa",
    "reflexion del papa",
)


class VaticanNewsScraper(BaseScraper):

    SOURCE_KEY = "vaticanNews"
    SOURCE_URL = RSS_URL
    REQUIRED_FIELDS = ("comentario", "comentarista")
    WRITES_NODES = frozenset({"evangelio"})

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fetch(self) -> list[EvangelioData]:
        xml_content = self._fetch_xml()
        if xml_content is None:
            log.error("[VaticanNews] No se pudo obtener el feed RSS.")
            return []
        return self._parse(xml_content)

    # ------------------------------------------------------------------
    # HTTP
    # ------------------------------------------------------------------

    def _fetch_xml(self) -> str | None:
        session = requests.Session()
        for attempt, delay in enumerate(RETRY_DELAYS, start=1):
            try:
                log.info(f"[VaticanNews] Intento {attempt}/{len(RETRY_DELAYS)} → {RSS_URL}")
                resp = session.get(RSS_URL, headers=HEADERS, timeout=15)
                if resp.status_code == 200:
                    log.info(f"[VaticanNews] OK ({len(resp.content)} bytes)")
                    return resp.text
                log.warning(f"[VaticanNews] HTTP {resp.status_code} en intento {attempt}")
            except requests.RequestException as e:
                log.warning(f"[VaticanNews] Error de red en intento {attempt}: {e}")
            if attempt < len(RETRY_DELAYS):
                time.sleep(delay)
        log.error("[VaticanNews] Todos los intentos fallaron.")
        return None

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------

    def _parse(self, xml_content: str) -> list[EvangelioData]:
        soup = BeautifulSoup(xml_content, "xml")
        items = soup.find_all("item")

        if not items:
            log.warning("[VaticanNews] No se encontraron items en el RSS.")
            return []

        results: list[EvangelioData] = []
        skipped = 0

        for item in items:
            data = self._parse_item(item)
            if data is not None:
                results.append(data)
            else:
                skipped += 1

        log.info(
            f"[VaticanNews] {len(results)} items con comentario, "
            f"{skipped} sin sección 'Palabras de los Papas' (saltados)."
        )
        return results

    def _parse_item(self, item) -> EvangelioData | None:
        title_el = item.find("title")
        pubdate_el = item.find("pubDate")
        desc_el = item.find("description")
        guid_el = item.find("guid")

        if not pubdate_el or not desc_el:
            return None

        # Date from pubDate
        try:
            dt = parsedate_to_datetime(pubdate_el.text)
            fecha = dt.strftime("%Y-%m-%d")
        except Exception as e:
            log.warning(f"[VaticanNews] No se pudo parsear fecha: {pubdate_el.text!r} — {e}")
            return None

        item_url = guid_el.text if guid_el else RSS_URL

        result = self._extract_palabras_papas(desc_el.text)
        if result is None:
            title = title_el.text.strip() if title_el else "?"
            log.warning(
                f"[VaticanNews] {fecha}: no se encontró sección 'Palabras de los Papas' "
                f"(título: {title!r})"
            )
            return None

        comentario, comentarista = result

        data = EvangelioData(url=item_url, fecha=fecha)
        data.comentario = comentario
        data.comentarista = comentarista
        return data

    # ------------------------------------------------------------------
    # Commentary extraction
    # ------------------------------------------------------------------

    def _extract_palabras_papas(self, desc_html: str) -> tuple[str, str] | None:
        """
        Find the "Las palabras de los Papas" section in the description HTML
        and extract (comentario_text, comentarista).

        Returns None if no matching section is found.
        """
        soup = BeautifulSoup(desc_html, "html.parser")

        # Walk only top-level elements to avoid double-processing nested tags.
        elements = [
            el for el in soup.children
            if hasattr(el, "name") and el.name is not None
        ]

        # Find the section header index
        header_idx: int | None = None
        for i, el in enumerate(elements):
            text_lower = el.get_text(" ", strip=True).lower()
            if any(pat in text_lower for pat in _PAPAS_PATTERNS):
                header_idx = i
                break

        if header_idx is None:
            return None

        # Collect paragraphs after the header until the next heading or end
        commentary_paras: list[str] = []
        for el in elements[header_idx + 1:]:
            if el.name in ("h1", "h2", "h3", "h4", "h5"):
                break  # Next section starts
            if el.name == "p":
                text = el.get_text(" ", strip=True)
                if text:
                    commentary_paras.append(text)

        if not commentary_paras:
            return None

        comentario = join_paragraphs(commentary_paras)
        comentarista = _extract_author(commentary_paras[-1])
        return comentario, comentarista


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
