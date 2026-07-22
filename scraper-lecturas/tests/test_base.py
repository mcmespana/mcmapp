"""
Tests de scrapers.base.BaseScraper.validate() — guarda de fecha ISO
(Plan 005: una `fecha="unknown"` (u otro formato no ISO) no debe pasar la
validación y por tanto nunca se escribe en Firebase bajo una clave que ni
la app lee ni el cleanup reclama).
"""

from scrapers.base import BaseScraper, EvangelioData


class _StubScraper(BaseScraper):
    SOURCE_KEY = "stub"

    def fetch(self):
        return []


def _valid_data(fecha: str) -> EvangelioData:
    return EvangelioData(
        url="https://example.com",
        fecha=fecha,
        cita="Juan 1,1",
        comentario="Comentario",
        comentarista="Alguien",
    )


def test_unknown_fecha_rejected():
    assert _StubScraper().validate(_valid_data("unknown")) is False


def test_valid_iso_fecha_passes():
    assert _StubScraper().validate(_valid_data("2026-07-18")) is True


def test_other_non_iso_formats_rejected():
    for fecha in ["18/07/2026", "2026-7-18", "", "2026-07-18T00:00:00Z"]:
        assert _StubScraper().validate(_valid_data(fecha)) is False
