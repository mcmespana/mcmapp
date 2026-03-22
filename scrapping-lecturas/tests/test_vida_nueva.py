"""
Tests for VidaNuevaScraper using the real HTML snapshot.

Run with:  pytest tests/ -v
"""

from pathlib import Path

import pytest
import responses as responses_lib

from scrapers.vida_nueva import VidaNuevaScraper, URL

# Path to the real HTML snapshot committed to the repo
HTML_FIXTURE = Path(__file__).parent.parent / "ejemplo_vida_nueva.html"


@pytest.fixture
def html_content() -> str:
    return HTML_FIXTURE.read_text(encoding="utf-8")


@pytest.fixture
def scraper() -> VidaNuevaScraper:
    return VidaNuevaScraper()


@responses_lib.activate
def test_parse_comentarista(scraper, html_content):
    responses_lib.add(responses_lib.GET, URL, body=html_content, status=200)
    data = scraper.fetch()
    assert data.comentarista == "Pedro Fraile Yécora"


@responses_lib.activate
def test_parse_fecha(scraper, html_content):
    responses_lib.add(responses_lib.GET, URL, body=html_content, status=200)
    data = scraper.fetch()
    assert data.fecha == "2026-03-21"


@responses_lib.activate
def test_parse_cita(scraper, html_content):
    responses_lib.add(responses_lib.GET, URL, body=html_content, status=200)
    data = scraper.fetch()
    assert data.cita is not None
    assert "Juan" in data.cita
    assert "Evangelio:" not in data.cita  # prefix must be stripped


@responses_lib.activate
def test_parse_evangelio_texto(scraper, html_content):
    responses_lib.add(responses_lib.GET, URL, body=html_content, status=200)
    data = scraper.fetch()
    assert data.evangelio_texto is not None
    assert len(data.evangelio_texto) > 100
    # Should contain gospel narrative
    assert "Jesús" in data.evangelio_texto or "aquel tiempo" in data.evangelio_texto


@responses_lib.activate
def test_parse_comentario(scraper, html_content):
    responses_lib.add(responses_lib.GET, URL, body=html_content, status=200)
    data = scraper.fetch()
    assert data.comentario is not None
    assert len(data.comentario) > 200


@responses_lib.activate
def test_parse_primera_lectura(scraper, html_content):
    responses_lib.add(responses_lib.GET, URL, body=html_content, status=200)
    data = scraper.fetch()
    assert data.primera_lectura is not None
    assert "Jeremías" in data.primera_lectura or "Miqueas" in data.primera_lectura


@responses_lib.activate
def test_parse_salmo(scraper, html_content):
    responses_lib.add(responses_lib.GET, URL, body=html_content, status=200)
    data = scraper.fetch()
    assert data.salmo is not None


@responses_lib.activate
def test_validate_passes(scraper, html_content):
    responses_lib.add(responses_lib.GET, URL, body=html_content, status=200)
    data = scraper.fetch()
    assert scraper.validate(data) is True


@responses_lib.activate
def test_firebase_payload_keys(scraper, html_content):
    responses_lib.add(responses_lib.GET, URL, body=html_content, status=200)
    data = scraper.fetch()
    payload = scraper.to_firebase_payload(data)

    assert payload["activo"] == "vidaNueva"
    assert "vidaNuevaCita" in payload
    assert "vidaNuevaComentario" in payload
    assert "vidaNuevaComentarista" in payload
    assert "vidaNuevaURL" in payload
    assert "vidaNuevaLastUpdated" in payload


@responses_lib.activate
def test_http_403_returns_error_data(scraper):
    responses_lib.add(responses_lib.GET, URL, status=403)
    # All retries will also return 403 (responses library matches all calls)
    data = scraper.fetch()
    assert data.error is not None
    assert data.comentarista is None


@responses_lib.activate
def test_no_html_artifacts_in_comentario(scraper, html_content):
    """Commentary text must be clean plaintext — no HTML tags."""
    responses_lib.add(responses_lib.GET, URL, body=html_content, status=200)
    data = scraper.fetch()
    assert data.comentario is not None
    assert "<" not in data.comentario
    assert ">" not in data.comentario
