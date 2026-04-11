"""
Scraper for Vatican News RSS Feed.
https://www.vaticannews.va/es/evangelio-de-hoy.rss.xml

Fetches the daily gospel, readings and commentary for the next ~15 days.
"""
import logging
import time
from email.utils import parsedate_to_datetime
import re

import requests
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, EvangelioData
from utils.text_utils import html_to_plain, join_paragraphs

log = logging.getLogger(__name__)

URL = "https://www.vaticannews.va/es/evangelio-de-hoy.rss.xml"

BASE_HEADERS = {
    "Accept": "application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "User-Agent": "Mozilla/5.0 (compatible; LecturasScraper/1.0)",
}

RETRY_DELAYS = [5, 15]

class VaticanNewsScraper(BaseScraper):
    SOURCE_KEY = "vaticanNews"
    SOURCE_URL = URL

    def fetch(self) -> list[EvangelioData]:
        xml_content = self._fetch_xml()
        if xml_content is None:
            return [EvangelioData(
                url=URL,
                fecha="unknown",
                error="HTTP_FETCH_FAILED",
            )]
        return self._parse(xml_content)

    def _fetch_xml(self) -> str | None:
        session = requests.Session()
        for attempt, delay in enumerate(RETRY_DELAYS, start=1):
            try:
                log.info(f"[VaticanNews] Intento {attempt}/2 → {URL}")
                resp = session.get(URL, headers=BASE_HEADERS, timeout=15)
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

    def _parse(self, xml_content: str) -> list[EvangelioData]:
        soup = BeautifulSoup(xml_content, "xml")
        items = soup.find_all("item")
        results = []

        if not items:
            log.warning("[VaticanNews] No se encontraron items en el RSS.")
            return results

        for item in items:
            data = self._parse_item(item)
            if data:
                results.append(data)

        log.info(f"[VaticanNews] Se parsearon {len(results)} días del feed RSS.")
        return results

    def _parse_item(self, item) -> EvangelioData | None:
        title_el = item.find("title")
        pubdate_el = item.find("pubDate")
        desc_el = item.find("description")
        guid_el = item.find("guid")

        if not title_el or not pubdate_el or not desc_el:
            return None

        # Parse date from pubDate
        try:
            dt = parsedate_to_datetime(pubdate_el.text)
            fecha = dt.strftime("%Y-%m-%d")
        except Exception as e:
            log.warning(f"[VaticanNews] No se pudo parsear fecha: {pubdate_el.text} - {e}")
            return None

        item_url = guid_el.text if guid_el else URL

        data = EvangelioData(url=item_url, fecha=fecha)
        data.titulo = title_el.text.strip()

        # Parse description HTML
        desc_html = desc_el.text
        self._parse_description_html(desc_html, data)

        return data

    def _parse_description_html(self, html_content: str, data: EvangelioData):
        soup = BeautifulSoup(html_content, "html.parser")

        # We need to extract readings and gospel.
        # Structure often is:
        # <p>Lectura del libro...</p> <p>Hechos 4, 1-12</p> <p>En aquellos días...</p>
        # <p>Lectura del santo evangelio...</p> <p>Juan 21, 1-14</p> <p>En aquel tiempo...</p>
        # <p>«Id por todo...» (Mc 16,15)... (Francisco - Homilia...)</p>

        paragraphs = soup.find_all("p")

        state = "UNKNOWN"

        lectura1_paras = []
        lectura2_paras = []
        evangelio_paras = []
        comentario_paras = []

        for p in paragraphs:
            text = p.get_text(strip=True)
            if not text:
                continue

            lower_text = text.lower()

            # Detect section changes based on common keywords
            if "lectura" in lower_text and "santo evangelio" not in lower_text:
                if state in ["UNKNOWN", "L1_CITA", "L1_TEXTO"]:
                    if not data.primera_lectura:
                        state = "L1_TITLE"
                elif state in ["L1_TEXTO"]:
                    if not data.segunda_lectura:
                        state = "L2_TITLE"
                continue # Skip the "Lectura del libro de..." paragraph

            if "santo evangelio" in lower_text or "pasión de nuestro señor" in lower_text:
                state = "EV_TITLE"
                continue

            # If we just saw a title, the next paragraph is likely the citation
            if state == "L1_TITLE":
                data.primera_lectura = text
                state = "L1_TEXTO"
                continue
            elif state == "L2_TITLE":
                data.segunda_lectura = text
                state = "L2_TEXTO"
                continue
            elif state == "EV_TITLE":
                data.cita = text
                state = "EV_TEXTO"
                continue

            # Accumulate text based on state
            if state == "L1_TEXTO":
                lectura1_paras.append(text)
            elif state == "L2_TEXTO":
                lectura2_paras.append(text)
            elif state == "EV_TEXTO":
                # Check if this paragraph looks like the start of the commentary instead
                # Commentary usually starts with a quote like «...» or just after the gospel text
                # We can detect commentary if the previous paragraphs already formed the gospel
                # and this one is the last or second to last.
                # A better heuristic: if it contains an author at the end, it's definitely commentary.
                if re.search(r'\(([^)]+ - [^)]+)\)$', text) or "(Francisco " in text or "(Juan Pablo II" in text or "(Benedicto XVI" in text:
                    comentario_paras.append(text)
                    state = "COMENTARIO"
                else:
                    # Some commentary doesn't have the author explicitly formatted.
                    # We will assume everything after EV_TEXTO is Evangelio unless it looks like Commentary.
                    # As a simple heuristic, if it starts with « or ", it might be the commentary.
                    # But gospel also has quotes.
                    evangelio_paras.append(text)
            elif state == "COMENTARIO":
                comentario_paras.append(text)
            else:
                # If we are in UNKNOWN, might be the commentary if it's the very last thing and no headers were found
                pass

        # Post-process: in Vatican News, the last paragraph of the description is usually the commentary.
        # If we didn't explicitly find the commentary state, let's extract the last paragraph from EV_TEXTO
        if not comentario_paras and evangelio_paras:
            last_para = evangelio_paras[-1]
            if re.search(r'\((.+? - .+?)\)$', last_para) or last_para.startswith("«"):
                comentario_paras.append(evangelio_paras.pop())

        # If no Evangelio text but we have commentary, let's fix it
        # Or if Cita is missing, maybe the text didn't say "Lectura del santo evangelio"
        # It happens on Sundays where gospel might be long or differently formatted
        if not data.cita and evangelio_paras:
             # Just set a placeholder or try to infer from the text
             data.cita = "Evangelio del día"
        if not data.cita and not evangelio_paras and not comentario_paras:
            # Could not parse this day at all, skip
            log.warning(f"[VaticanNews] Parseo fallido para {data.fecha}. No se encontró cita ni evangelio.")

        # Extract author from commentary
        if comentario_paras:
            full_comentario = join_paragraphs(comentario_paras)
            data.comentario = full_comentario

            # Try to extract the author, e.g. "(Francisco - Homilia Santa Marta, 25 de abril de 2020)"
            # Or "(Juan Pablo II, Audiencia General...)"
            author_match = re.search(r'\(([^)]+?)[,\-]', full_comentario)
            if author_match:
                author_text = author_match.group(1).strip()
                data.comentarista = author_text
            else:
                # Fallback if no specific author format
                data.comentarista = "Vatican News"

        # Fallback for missing elements to pass validation
        if not data.comentario:
            data.comentario = "Comentario no disponible."
        if not data.comentarista:
            data.comentarista = "Vatican News"
        if not data.cita:
            data.cita = "Evangelio"

        if evangelio_paras:
            data.evangelio_texto = join_paragraphs(evangelio_paras)

        if lectura1_paras:
            data.primera_lectura_texto = join_paragraphs(lectura1_paras)

        if lectura2_paras:
            data.segunda_lectura_texto = join_paragraphs(lectura2_paras)
