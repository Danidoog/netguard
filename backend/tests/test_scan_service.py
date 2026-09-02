from unittest.mock import MagicMock
from app.services.scan_service import ScanService
from app.models.scan_result import ScanResult
from app.models.host import Host
from app.db.models import ScanRecord, HostRecord


def make_fake_result():
    return ScanResult(
        target="192.168.0.0/24",
        hosts=[Host(ip="192.168.0.1", hostname="router", mac="AA:BB:CC:00:11:22", vendor="TP-Link", status="up")],
        total_hosts=1,
        duration_seconds=2.5,
        scanned_at="2026-09-01T10:00:00Z",
    )


def test_scan_network_saves_to_db(db_session, monkeypatch):
    fake_scanner = MagicMock()
    fake_scanner.scan_hosts.return_value = make_fake_result()

    service = ScanService(fake_scanner)

    # Reemplazamos el SessionLocal que usa el service por el de prueba
    monkeypatch.setattr("app.services.scan_service.SessionLocal", lambda: db_session)

    result = service.scan_network()

    assert result.total_hosts == 1
    saved_scan = db_session.query(ScanRecord).first()
    assert saved_scan is not None
    assert saved_scan.target == "192.168.0.0/24"

    saved_host = db_session.query(HostRecord).first()
    assert saved_host.ip == "192.168.0.1"
    assert saved_host.scan_id == saved_scan.id