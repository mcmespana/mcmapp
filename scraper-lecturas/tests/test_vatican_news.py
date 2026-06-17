"""Unit tests for scrapers/vatican_news.py — parsing only, no HTTP."""

from pathlib import Path
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup

from scrapers.vatican_news import VaticanNewsScraper, _extract_author

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def scraper():
    # Single test date, no HTTP calls in tests
    return VaticanNewsScraper(fechas=["2026-04-13"])


@pytest.fixture
def html_with_papas() -> str:
    return (FIXTURES / "vatican_news.html").read_text(encoding="utf-8")


@pytest.fixture
def html_no_papas() -> str:
    return (FIXTURES / "vatican_news_no_papas.html").read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# HTML parsing — per-date fetch
# ---------------------------------------------------------------------------

class TestHTMLParsing:
    def test_returns_one_result(self, scraper, html_with_papas):
        with patch.object(scraper, "_get_html", return_value=html_with_papas):
            results = scraper.fetch()
        assert len(results) == 1

    def test_fecha_correct(self, scraper, html_with_papas):
        with patch.object(scraper, "_get_html", return_value=html_with_papas):
            results = scraper.fetch()
        assert results[0].fecha == "2026-04-13"

    def test_comentario_present(self, scraper, html_with_papas):
        with patch.object(scraper, "_get_html", return_value=html_with_papas):
            results = scraper.fetch()
        assert "Espíritu Santo" in results[0].comentario

    def test_comentarista_dash_format(self, scraper, html_with_papas):
        """Author extracted from "(Benedicto XVI - …)" using " - " split."""
        with patch.object(scraper, "_get_html", return_value=html_with_papas):
            results = scraper.fetch()
        assert results[0].comentarista == "Benedicto XVI"

    def test_no_papas_returns_empty(self, scraper, html_no_papas):
        with patch.object(scraper, "_get_html", return_value=html_no_papas):
            results = scraper.fetch()
        assert results == []

    def test_http_none_returns_empty(self, scraper):
        with patch.object(scraper, "_get_html", return_value=None):
            results = scraper.fetch()
        assert results == []

    def test_no_evangelio_fields(self, scraper, html_with_papas):
        """VaticanNews must NOT write cita, evangelio_texto, primera_lectura…"""
        with patch.object(scraper, "_get_html", return_value=html_with_papas):
            results = scraper.fetch()
        for r in results:
            assert r.cita is None
            assert r.evangelio_texto is None
            assert r.primera_lectura is None

    def test_writes_nodes_evangelio_only(self, scraper):
        assert scraper.WRITES_NODES == frozenset({"evangelio"})


# ---------------------------------------------------------------------------
# _extract_palabras_papas — section detection
# ---------------------------------------------------------------------------

class TestPalabrasPapas:
    def _soup(self, html: str) -> BeautifulSoup:
        return BeautifulSoup(html, "html.parser")

    def test_found_h2_in_section_head(self, scraper):
        html = """
        <section class="section section--evidence section--isStatic">
          <div class="section__head"><h2>Las palabras de los Papas</h2></div>
          <div class="section__wrapper">
            <div class="section__content">
              <p>«El Espíritu nos guía.»</p>
              <p>(Juan Pablo II - Carta Apostólica, 2001)</p>
            </div>
          </div>
        </section>
        """
        result = scraper._extract_palabras_papas(self._soup(html))
        assert result is not None
        comentario, autor = result
        assert "Espíritu" in comentario
        assert autor == "Juan Pablo II"

    def test_found_palabras_del_papa_variant(self, scraper):
        html = """
        <section class="section section--evidence">
          <div class="section__head"><h2>Las palabras del Papa</h2></div>
          <div class="section__wrapper">
            <div class="section__content">
              <p>«La fe mueve montañas.»</p>
              <p>(Francisco, Audiencia General, 2020)</p>
            </div>
          </div>
        </section>
        """
        result = scraper._extract_palabras_papas(self._soup(html))
        assert result is not None
        _, autor = result
        assert autor == "Francisco"

    def test_non_papas_section_ignored(self, scraper):
        html = """
        <section class="section section--evidence">
          <div class="section__head"><h2>Lectura del Día</h2></div>
          <div class="section__wrapper">
            <div class="section__content"><p>Solo lectura.</p></div>
          </div>
        </section>
        """
        assert scraper._extract_palabras_papas(self._soup(html)) is None

    def test_empty_content_returns_none(self, scraper):
        html = """
        <section class="section section--evidence">
          <div class="section__head"><h2>Las palabras de los Papas</h2></div>
          <div class="section__wrapper">
            <div class="section__content"></div>
          </div>
        </section>
        """
        assert scraper._extract_palabras_papas(self._soup(html)) is None

    def test_picks_papas_section_among_multiple(self, scraper, html_with_papas):
        """Fixture has 3 sections; only the Papas one should be picked."""
        soup = BeautifulSoup(html_with_papas, "html.parser")
        result = scraper._extract_palabras_papas(soup)
        assert result is not None
        comentario, _ = result
        # Papas section text, not lecturas
        assert "Espíritu Santo" in comentario
        assert "Juan 20" not in comentario


# ---------------------------------------------------------------------------
# Author extraction
# ---------------------------------------------------------------------------

class TestExtractAuthor:
    def test_dash_format(self):
        text = "«Texto.» (Benedicto XVI - Audiencia general, 14 de abril de 2010)"
        assert _extract_author(text) == "Benedicto XVI"

    def test_comma_format(self):
        text = "«Texto.» (Francisco, Homilía Vigilia Pascual, 19 de abril de 2014)"
        assert _extract_author(text) == "Francisco"

    def test_no_parenthesis_returns_fallback(self):
        assert _extract_author("Sin autor") == "Vatican News"

    def test_partial_author(self):
        text = "(Juan Pablo II)"
        assert _extract_author(text) == "Juan Pablo II"


# ---------------------------------------------------------------------------
# Payload selectors
# ---------------------------------------------------------------------------

class TestPayloadSelectors:
    def test_evangelio_payload_sets_activoComentario(self, scraper, html_with_papas):
        with patch.object(scraper, "_get_html", return_value=html_with_papas):
            results = scraper.fetch()
        payload = scraper.to_evangelio_payload(results[0])
        assert payload.get("activoComentario") == "vaticanNews"

    def test_evangelio_payload_no_activoTexto(self, scraper, html_with_papas):
        with patch.object(scraper, "_get_html", return_value=html_with_papas):
            results = scraper.fetch()
        payload = scraper.to_evangelio_payload(results[0])
        assert "activoTexto" not in payload

    def test_validate_passes(self, scraper, html_with_papas):
        with patch.object(scraper, "_get_html", return_value=html_with_papas):
            results = scraper.fetch()
        assert all(scraper.validate(r) for r in results)
