"""
Scraper for https://www.vidanuevadigital.com/evangeliodeldia/

HTML structure (verified with real page, 2026-03-21):

  div.type-evangeliodeldia-single
  ├── div.evangeliodeldia-author
  │   └── div.data-name.author → a        ← comentarista
  ├── div.entry-date                       ← "21 / 03 / 2026"
  ├── h2.entry-title                       ← título del comentario
  ├── h3.entry-excerpt                     ← día litúrgico (santos)
  ├── div.entry-meta
  │   ├── p  strong "Primera lectura:"  em ← primera lectura (siempre)
  │   ├── p  strong "Salmo:"  em           ← salmo (siempre)
  │   └── p  strong "Segunda lectura:" em  ← segunda lectura (no siempre)
  └── div.entry-content.mb40
      ├── h3  strong "Evangelio:"          ← cita (ej. "Juan 7,40-53")
      ├── p...                             ← texto del evangelio (\n\n entre párrafos)
      ├── h3  strong "Comentario"          ← separador
      └── p...                            ← texto del comentario (\n\n entre párrafos)
"""

import logging
import time

import requests
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, EvangelioData
from utils.date_utils import parse_vida_nueva_date
from utils.text_utils import html_to_plain, join_paragraphs

log = logging.getLogger(__name__)

URL = "https://www.vidanuevadigital.com/evangeliodeldia/"

# Rotate User-Agents across retry attempts to avoid WAF fingerprinting
USER_AGENTS = [
    # Chrome Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36",
    # Firefox Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) "
    "Gecko/20100101 Firefox/125.0",
    # Safari macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.4.1 Safari/605.1.15",
]

BASE_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,"
              "image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
    "Referer": "https://www.google.es/",
}

RETRY_DELAYS = [5, 15, 30]  # seconds between attempts


class VidaNuevaScraper(BaseScraper):

    SOURCE_KEY = "vidaNueva"
    SOURCE_URL = URL

    def fetch(self) -> list[EvangelioData]:
        html_content = self._fetch_html()
        if html_content is None:
            return [EvangelioData(
                url=URL,
                fecha="unknown",
                error="HTTP_FETCH_FAILED",
            )]
        return [self._parse(html_content)]

    # ------------------------------------------------------------------
    # HTTP
    # ------------------------------------------------------------------

    def _fetch_html(self) -> str | None:
        session = requests.Session()

        for attempt, delay in enumerate(RETRY_DELAYS, start=1):
            ua = USER_AGENTS[(attempt - 1) % len(USER_AGENTS)]
            headers = {**BASE_HEADERS, "User-Agent": ua}

            try:
                log.info(f"[VidaNueva] Intento {attempt}/3 → {URL}")
                resp = session.get(URL, headers=headers, timeout=15)

                if resp.status_code == 200:
                    log.info(f"[VidaNueva] OK ({len(resp.content)} bytes)")
                    return resp.text

                if resp.status_code == 403:
                    log.warning(
                        f"[VidaNueva] HTTP 403 en intento {attempt} "
                        f"(x-deny-reason: {resp.headers.get('x-deny-reason', 'n/a')})"
                    )
                else:
                    log.warning(f"[VidaNueva] HTTP {resp.status_code} en intento {attempt}")

            except requests.Timeout:
                log.warning(f"[VidaNueva] Timeout en intento {attempt}")
            except requests.RequestException as e:
                log.warning(f"[VidaNueva] Error de red en intento {attempt}: {e}")

            if attempt < len(RETRY_DELAYS):
                log.info(f"[VidaNueva] Reintentando en {delay}s...")
                time.sleep(delay)

        log.error("[VidaNueva] Todos los intentos fallaron.")
        return None

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------

    def _parse(self, html_content: str) -> EvangelioData:
        soup = BeautifulSoup(html_content, "lxml")

        data = EvangelioData(url=URL, fecha="unknown")

        # -- Container -------------------------------------------------
        container = soup.select_one(".type-evangeliodeldia-single")
        if not container:
            log.error("[VidaNueva] No se encontró .type-evangeliodeldia-single")
            data.error = "CONTAINER_NOT_FOUND"
            return data

        # -- Commentator -----------------------------------------------
        autor_el = container.select_one(".evangeliodeldia-author .data-name a")
        if autor_el:
            data.comentarista = autor_el.get_text(strip=True)
            log.info(f"[VidaNueva] Comentarista: {data.comentarista}")
        else:
            log.warning("[VidaNueva] No se encontró el comentarista")

        # -- Date (use page date as Firebase key, not the cron date) ---
        date_el = container.select_one(".entry-date")
        if date_el:
            try:
                data.fecha = parse_vida_nueva_date(date_el.get_text(strip=True))
                log.info(f"[VidaNueva] Fecha: {data.fecha}")
            except ValueError as e:
                log.warning(f"[VidaNueva] No se pudo parsear la fecha: {e}")

        # -- Title -----------------------------------------------------
        title_el = container.select_one("h2.entry-title")
        if title_el:
            data.titulo = title_el.get_text(strip=True)

        # -- Día litúrgico (santos) ------------------------------------
        liturgico_el = container.select_one("h3.entry-excerpt")
        if liturgico_el:
            data.dia_liturgico = liturgico_el.get_text(strip=True)

        # -- Lecturas y Salmo (entry-meta) -----------------------------
        # Matches: Primera lectura, Salmo, Segunda lectura (optional)
        for p in container.select(".entry-meta p"):
            strong = p.find("strong")
            if not strong:
                continue
            label = strong.get_text(strip=True)
            em = p.find("em")
            value = em.get_text(strip=True) if em else p.get_text(strip=True)

            if "Primera lectura" in label:
                data.primera_lectura = value
                log.info(f"[VidaNueva] Primera lectura: {value}")
            elif "Segunda lectura" in label:
                data.segunda_lectura = value
                log.info(f"[VidaNueva] Segunda lectura: {value}")
            elif "Salmo" in label:
                data.salmo = value
                log.info(f"[VidaNueva] Salmo: {value}")

        # -- entry-content: cita, gospel text, commentary --------------
        content_div = container.select_one(".entry-content")
        if not content_div:
            log.error("[VidaNueva] No se encontró .entry-content")
            data.error = "CONTENT_NOT_FOUND"
            return data

        self._parse_content(content_div, data)

        return data

    def _parse_content(self, content_div, data: EvangelioData) -> None:
        """
        Walk the direct children of .entry-content in document order.

        Paragraph text is stored as plain text with:
          - \\n between lines (from <br> tags within a paragraph)
          - \\n\\n between paragraphs (<p> elements)

        State machine:
          BEFORE    → scanning for "Evangelio:" h3
          GOSPEL    → collecting <p> as gospel text
          COMMENTARY → collecting <p> as commentary
        """
        state = "BEFORE"
        evangelio_paras: list[str] = []
        comentario_paras: list[str] = []

        for child in content_div.children:
            if not hasattr(child, "name") or child.name is None:
                continue  # skip NavigableString (whitespace nodes)

            if child.name == "h3":
                text = child.get_text()
                if "Evangelio" in text:
                    raw_cita = text.replace("Evangelio:", "").strip()
                    data.cita = " ".join(raw_cita.split())
                    state = "GOSPEL"
                    log.info(f"[VidaNueva] Cita: {data.cita}")
                elif "Comentario" in text:
                    state = "COMMENTARY"

            elif child.name == "p":
                plain = html_to_plain(child)
                if not plain:
                    continue
                if state == "GOSPEL":
                    evangelio_paras.append(plain)
                elif state == "COMMENTARY":
                    comentario_paras.append(plain)

        if evangelio_paras:
            data.evangelio_texto = join_paragraphs(evangelio_paras)
        else:
            log.warning("[VidaNueva] No se encontró texto del evangelio")

        if comentario_paras:
            data.comentario = join_paragraphs(comentario_paras)
            log.info(f"[VidaNueva] Comentario: {len(data.comentario)} chars")
        else:
            log.warning("[VidaNueva] No se encontró el comentario")
            data.error = "COMMENTARY_NOT_FOUND"
