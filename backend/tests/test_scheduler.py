import os
import tempfile
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.db.models import ScanTaskRecord, SchedulerConfigRecord
from app.main import app, scheduler_service
from app.services.scheduler_service import SchedulerService


@pytest.fixture
def session_factory():
    temp_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    temp_file.close()
    db_path = temp_file.name
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    yield factory
    engine.dispose()
    if os.path.exists(db_path):
        os.unlink(db_path)


@pytest.fixture(autouse=True)
def clean_scheduler_db(session_factory, monkeypatch):
    monkeypatch.setattr("app.main.SessionLocal", session_factory)
    monkeypatch.setattr("app.services.task_service.SessionLocal", session_factory)
    monkeypatch.setattr("app.services.scheduler_service.SessionLocal", session_factory)

    import app.main as main_module
    test_scheduler = SchedulerService(main_module.task_service, check_interval_seconds=0.1)
    monkeypatch.setattr("app.main.scheduler_service", test_scheduler)

    db = session_factory()
    db.query(ScanTaskRecord).delete()
    db.query(SchedulerConfigRecord).delete()
    db.commit()
    db.close()

    yield test_scheduler
    test_scheduler.stop(timeout=1.0)


def test_get_default_scheduler_config():
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.get("/api/config/scheduler")
    assert resp.status_code == 200
    body = resp.json()
    assert body["enabled"] is False
    assert body["interval_minutes"] == 30
    assert body["target"] is None


def test_update_scheduler_config():
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post(
        "/api/config/scheduler",
        json={"enabled": True, "interval_minutes": 15, "target": "192.168.1.0/24"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["enabled"] is True
    assert body["interval_minutes"] == 15
    assert body["target"] == "192.168.1.0/24"
    assert body["next_run_at"] is not None


def test_partial_update_preserves_target():
    client = TestClient(app, raise_server_exceptions=False)
    # Set initial target
    client.post(
        "/api/config/scheduler",
        json={"enabled": False, "interval_minutes": 20, "target": "192.168.10.0/24"},
    )
    # Toggle enabled only
    resp = client.post("/api/config/scheduler", json={"enabled": True})
    assert resp.status_code == 200
    body = resp.json()
    assert body["enabled"] is True
    assert body["target"] == "192.168.10.0/24"
    assert body["interval_minutes"] == 20


def test_update_scheduler_config_validations():
    client = TestClient(app, raise_server_exceptions=False)
    # Intervalo inválido (< 1)
    resp_invalid_interval = client.post("/api/config/scheduler", json={"interval_minutes": 0})
    assert resp_invalid_interval.status_code == 400

    # Target inválido
    resp_invalid_target = client.post(
        "/api/config/scheduler",
        json={"target": "ip-no-valida"},
    )
    assert resp_invalid_target.status_code == 400


def test_scheduler_triggers_due_scan(session_factory, monkeypatch):
    import app.main as main_module
    client = TestClient(app, raise_server_exceptions=False)

    fake_scanner = MagicMock()
    fake_scanner.scan_hosts.return_value = MagicMock(id=1, hosts=[], total_hosts=0, duration_seconds=1.0, scanned_at="2026-10-14T22:00:00Z")
    fake_scanner._validate_target = MagicMock()
    monkeypatch.setattr("app.main.scan_service.scanner", fake_scanner)

    # Activar scheduler
    client.post("/api/config/scheduler", json={"enabled": True, "interval_minutes": 10})

    # Ejecutar check_and_trigger_due_scan directamente
    triggered = main_module.scheduler_service.check_and_trigger_due_scan()
    assert triggered is True

    # Verificar que se creó una tarea
    db = session_factory()
    try:
        tasks = db.query(ScanTaskRecord).all()
        assert len(tasks) == 1
    finally:
        db.close()


def test_scheduler_skips_when_scan_already_active(session_factory):
    import app.main as main_module
    client = TestClient(app, raise_server_exceptions=False)

    # Insertar una tarea en ejecución
    db = session_factory()
    try:
        active_task = ScanTaskRecord(id="task-activa", status="running")
        db.add(active_task)
        db.commit()
    finally:
        db.close()

    # Activar scheduler
    client.post("/api/config/scheduler", json={"enabled": True, "interval_minutes": 10})

    # El trigger debe omitirse porque ya hay una tarea en curso
    triggered = main_module.scheduler_service.check_and_trigger_due_scan()
    assert triggered is False
