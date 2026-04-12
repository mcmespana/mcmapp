"""Unit tests for scrapers/vatican_news.py — parsing only, no HTTP."""

from pathlib import Path
from unittest.mock import patch

import pytest

from scrapers.vatican_news import VaticanNewsScraper, _extract_author

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def scraper():
    return VaticanNewsScraper()


@pytest.fixture
def rss_content():
    return (FIXTURES / "vatican_news.rss").read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# RSS parsing
# ---------------------------------------------------------------------------

class TestRSSParsing:
    def test_parses_two_valid_items(self, scraper, rss_content):
        """Items 1 and 2 have palabras section; item 3 does not."""
        with patch.object(scraper, "_fetch_xml", return_value=rss_content):
            results = scraper.fetch()
        assert len(results) == 2

    def test_item1_fecha(self, scraper, rss_content):
        with patch.object(scraper, "_fetch_xml", return_value=rss_content):
            results = scraper.fetch()
        assert results[0].fecha == "2026-04-13"

    def test_item1_comentario_present(self, scraper, rss_content):
        with patch.object(scraper, "_fetch_xml", return_value=rss_content):
            results = scraper.fetch()
        assert "Espíritu Santo" in results[0].comentario

    def test_item1_comentarista_dash_format(self, scraper, rss_content):
        """Author extracted from "(Benedicto XVI - …)" using " - " split."""
        with patch.object(scraper, "_fetch_xml", return_value=rss_content):
            results = scraper.fetch()
        assert results[0].comentarista == "Benedicto XVI"

    def test_item2_comentarista_comma_format(self, scraper, rss_content):
        """Author extracted from "(Francisco, …)" using "," split."""
        with patch.object(scraper, "_fetch_xml", return_value=rss_content):
            results = scraper.fetch()
        assert results[1].comentarista == "Francisco"

    def test_item3_skipped(self, scraper, rss_content):
        """Item 3 has no 'Palabras' section → excluded from results."""
        with patch.object(scraper, "_fetch_xml", return_value=rss_content):
            results = scraper.fetch()
        dates = {r.fecha for r in results}
        assert "2026-04-15" not in dates

    def test_no_evangelio_fields(self, scraper, rss_content):
        """VaticanNews must NOT write cita, evangelio_texto, primera_lectura…"""
        with patch.object(scraper, "_fetch_xml", return_value=rss_content):
            results = scraper.fetch()
        for r in results:
            assert r.cita is None
            assert r.evangelio_texto is None
            assert r.primera_lectura is None

    def test_writes_nodes_evangelio_only(self, scraper):
        assert scraper.WRITES_NODES == frozenset({"evangelio"})


# ---------------------------------------------------------------------------
# Commentary extraction
# ---------------------------------------------------------------------------

class TestPalabrasPapas:
    def test_found_h3_header(self, scraper):
        html = """
        <p>Texto del evangelio</p>
        <h3>Las palabras de los Papas</h3>
        <p>«El Espíritu nos guía.»</p>
        <p>(Juan Pablo II - Carta Apostólica, 2001)</p>
        """
        result = scraper._extract_palabras_papas(html)
        assert result is not None
        comentario, autor = result
        assert "Espíritu" in comentario
        assert autor == "Juan Pablo II"

    def test_found_strong_para_header(self, scraper):
        html = """
        <p><strong>Las palabras de los Papas</strong></p>
        <p>«La fe mueve montañas.»</p>
        <p>(Francisco, Audiencia General, 2020)</p>
        """
        result = scraper._extract_palabras_papas(html)
        assert result is not None
        _, autor = result
        assert autor == "Francisco"

    def test_not_found_returns_none(self, scraper):
        html = "<p>Solo evangelio sin comentario papal.</p>"
        assert scraper._extract_palabras_papas(html) is None

    def test_empty_section_returns_none(self, scraper):
        html = "<h3>Las palabras de los Papas</h3>"
        assert scraper._extract_palabras_papas(html) is None


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
    def test_evangelio_payload_sets_activoComentario(self, scraper, rss_content):
        with patch.object(scraper, "_fetch_xml", return_value=rss_content):
            results = scraper.fetch()
        payload = scraper.to_evangelio_payload(results[0])
        assert payload.get("activoComentario") == "vaticanNews"

    def test_evangelio_payload_no_activoTexto(self, scraper, rss_content):
        with patch.object(scraper, "_fetch_xml", return_value=rss_content):
            results = scraper.fetch()
        payload = scraper.to_evangelio_payload(results[0])
        assert "activoTexto" not in payload

    def test_validate_passes(self, scraper, rss_content):
        with patch.object(scraper, "_fetch_xml", return_value=rss_content):
            results = scraper.fetch()
        assert all(scraper.validate(r) for r in results)
