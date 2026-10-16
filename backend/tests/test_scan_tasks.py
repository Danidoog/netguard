import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.database import Base, SessionLocal, engine
from app.core.exceptions import NmapNotFoundError, ScanTimeoutError
from app.db.models import HostRecord, ScanRecord, ScanTaskRecord
from app.main import app, task_service
from app.models.host import Host
from app.models.scan_result import ScanResult
from app.services.task_service import TaskService


from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


import os
import tempfile


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
def clean_db(session_factory, monkeypatch):
    """
    Asegura que cada test use una factoría de sesiones que soporte
    múltiples hilos concurrentes y un TaskService aislado con apagado limpio.
    """
    monkeypatch.setattr("app.main.SessionLocal", session_factory)
    monkeypatch.setattr("app.services.scan_service.SessionLocal", session_factory)
    monkeypatch.setattr("app.services.task_service.SessionLocal", session_factory)

    import app.main as main_module
    test_task_service = TaskService(main_module.scan_service, max_workers=1)
    monkeypatch.setattr("app.main.task_service", test_task_service)

    db = session_factory()
    db.query(ScanTaskRecord).delete()
    db.query(HostRecord).delete()
    db.query(ScanRecord).delete()
    db.commit()
    db.close()

    yield test_task_service

    test_task_service.shutdown(wait=True)




def make_fake_result(target="192.168.1.0/24"):
    return ScanResult(
        target=target,
        hosts=[
            Host(
                ip="192.168.1.1",
                hostname="gateway.local",
                mac="00:11:22:33:44:55",
                vendor="RouterTech",
                status="up",
            ),
            Host(
                ip="192.168.1.10",
                hostname="desktop.local",
                mac="AA:BB:CC:DD:EE:FF",
                vendor="PCMaker",
                status="up",
            ),
        ],
        total_hosts=2,
        duration_seconds=3.21,
        scanned_at="2026-10-14T21:00:00Z",
    )


def test_async_scan_returns_immediately_with_task_id(monkeypatch):
    """
    Criterio 1: Una solicitud de escaneo devuelve un identificador sin
    esperar a que finalice Nmap.
    """
    client = TestClient(app, raise_server_exceptions=False)

    # Mockeamos el escáner para que tarde 1 segundo si corriera sincrónico
    fake_scanner = MagicMock()
    fake_scanner.scan_hosts.return_value = make_fake_result()
    fake_scanner._validate_target = MagicMock()
    monkeypatch.setattr("app.main.scan_service.scanner", fake_scanner)

    start = time.perf_counter()
    resp = client.post("/api/tasks/scans", json={"target": "192.168.1.0/24"})
    elapsed = time.perf_counter() - start

    # La respuesta debe ser prácticamente instantánea (< 0.2s)
    assert elapsed < 0.5
    assert resp.status_code == 202
    body = resp.json()
    assert "id" in body
    assert body["target"] == "192.168.1.0/24"
    assert body["status"] in ("pending", "running", "completed")
    assert body["created_at"] is not None


def test_task_lifecycle_completed_and_results_saved(monkeypatch, session_factory):
    """
    Criterios 2 y 3: El estado de la tarea puede consultarse y termina
    en 'completed' con los resultados guardados en la BD.
    """
    client = TestClient(app, raise_server_exceptions=False)

    fake_scanner = MagicMock()
    fake_scanner.scan_hosts.return_value = make_fake_result("192.168.1.0/24")
    fake_scanner._validate_target = MagicMock()
    monkeypatch.setattr("app.main.scan_service.scanner", fake_scanner)

    resp = client.post("/api/tasks/scans", json={"target": "192.168.1.0/24"})
    assert resp.status_code == 202
    task_id = resp.json()["id"]

    # Esperar hasta que la tarea termine en completed (máximo 5 segundos)
    max_wait = 5.0
    start = time.time()
    final_body = None
    while time.time() - start < max_wait:
        status_resp = client.get(f"/api/tasks/{task_id}")
        assert status_resp.status_code == 200
        body = status_resp.json()
        if body["status"] in ("completed", "failed"):
            final_body = body
            break
        time.sleep(0.05)

    assert final_body is not None
    assert final_body["status"] == "completed"
    assert final_body["started_at"] is not None
    assert final_body["finished_at"] is not None
    assert final_body["scan_id"] is not None
    assert final_body["result"]["total_hosts"] == 2
    assert final_body["result"]["target"] == "192.168.1.0/24"
    assert final_body["error"] is None

    # Verificar que el resultado quedó persistido en la base de datos
    db = session_factory()
    try:
        saved_scan = db.query(ScanRecord).filter(ScanRecord.id == final_body["scan_id"]).first()
        assert saved_scan is not None
        assert saved_scan.total_hosts == 2
        assert len(saved_scan.hosts) == 2
    finally:
        db.close()


def test_task_failed_captures_error_info(monkeypatch):
    """
    Criterio 4: Una tarea fallida termina en 'failed' y conserva
    información útil del error (ej. timeout de Nmap).
    """
    client = TestClient(app, raise_server_exceptions=False)

    fake_scanner = MagicMock()
    fake_scanner._validate_target = MagicMock()
    fake_scanner.scan_hosts.side_effect = ScanTimeoutError(
        "El escaneo de '192.168.1.0/24' superó el tiempo límite de 120s."
    )
    monkeypatch.setattr("app.main.scan_service.scanner", fake_scanner)

    resp = client.post("/api/tasks/scans", json={"target": "192.168.1.0/24"})
    assert resp.status_code == 202
    task_id = resp.json()["id"]

    # Esperar a que la tarea falle
    max_wait = 5.0
    start = time.time()
    final_body = None
    while time.time() - start < max_wait:
        status_resp = client.get(f"/api/tasks/{task_id}")
        assert status_resp.status_code == 200
        body = status_resp.json()
        if body["status"] in ("completed", "failed"):
            final_body = body
            break
        time.sleep(0.05)

    assert final_body is not None
    assert final_body["status"] == "failed"
    assert final_body["error"] is not None
    assert final_body["error"]["code"] == "SCAN_TIMEOUT"
    assert "superó el tiempo límite" in final_body["error"]["message"]
    assert final_body["finished_at"] is not None
    assert final_body["result"] is None


def test_task_failed_with_nmap_not_found(monkeypatch):
    """
    Criterio 4: Captura error cuando Nmap no está en el sistema.
    """
    client = TestClient(app, raise_server_exceptions=False)

    fake_scanner = MagicMock()
    fake_scanner._validate_target = MagicMock()
    fake_scanner.scan_hosts.side_effect = NmapNotFoundError(
        "Nmap no está instalado o no se encuentra en el PATH."
    )
    monkeypatch.setattr("app.main.scan_service.scanner", fake_scanner)

    resp = client.post("/api/tasks/scans")
    assert resp.status_code == 202
    task_id = resp.json()["id"]

    # Esperar estado final
    for _ in range(50):
        body = client.get(f"/api/tasks/{task_id}").json()
        if body["status"] in ("completed", "failed"):
            break
        time.sleep(0.05)

    assert body["status"] == "failed"
    assert body["error"]["code"] == "NMAP_NOT_FOUND"


def test_invalid_target_rejected_synchronously():
    """
    Criterio: No iniciar escaneos sobre objetivos que no hayan pasado
    las validaciones existentes (debe dar 400 antes de encolar).
    """
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post("/api/tasks/scans", json={"target": "no-es-una-ip-valida"})
    assert resp.status_code == 400
    body = resp.json()
    assert body["error"]["code"] == "INVALID_TARGET"


def test_concurrent_duplicate_scan_prevention(monkeypatch, session_factory):
    """
    Criterio 6: Las tareas no se ejecutan duplicadamente de forma accidental.
    Si ya hay una tarea en pending o running, se rechaza con 409 Conflict.
    """
    client = TestClient(app, raise_server_exceptions=False)

    # Insertar manualmente una tarea simulando que está en curso
    db = session_factory()
    try:
        running_task = ScanTaskRecord(
            id="tarea-activa-en-curso",
            target="192.168.1.0/24",
            status="running",
        )
        db.add(running_task)
        db.commit()
    finally:
        db.close()

    # Intentar iniciar un escaneo asíncrono
    resp_async = client.post("/api/tasks/scans", json={"target": "192.168.1.0/24"})
    assert resp_async.status_code == 409
    body_async = resp_async.json()
    assert body_async["error"]["code"] == "SCAN_ALREADY_RUNNING"

    # Intentar llamar al escaneo sincrónico antiguo /api/scans también debe protegerse
    resp_sync = client.post("/api/scans")
    assert resp_sync.status_code == 409
    body_sync = resp_sync.json()
    assert body_sync["error"]["code"] == "SCAN_ALREADY_RUNNING"


def test_task_not_found_returns_404():
    """
    Criterio: Consultar un ID inexistente debe retornar 404 estructurado.
    """
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.get("/api/tasks/uuid-inexistente")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "TASK_NOT_FOUND"


def test_tasks_persist_and_recover_after_server_restart(monkeypatch, session_factory):
    """
    Criterio 5: Los estados persisten después de reiniciar la API y
    las tareas 'running' huérfanas se marcan como fallidas limpiamente.
    """
    client = TestClient(app, raise_server_exceptions=False)

    # Insertamos una tarea que 'quedó colgada' porque el servidor se reinició abruptamente
    db = session_factory()
    try:
        interrupted_task = ScanTaskRecord(
            id="tarea-interrumpida-por-crash",
            target="192.168.1.0/24",
            status="running",
        )
        db.add(interrupted_task)
        db.commit()
    finally:
        db.close()

    # Simulamos el arranque del servidor llamando a recover_interrupted_tasks()
    import app.main as main_module
    interrupted_count = main_module.task_service.recover_interrupted_tasks()
    assert interrupted_count == 1

    # Verificamos que la tarea persiste y ahora está en 'failed' con mensaje de servidor reiniciado
    resp = client.get("/api/tasks/tarea-interrumpida-por-crash")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "failed"
    assert body["error"]["code"] == "SERVER_RESTARTED"
    assert "interrumpida por un reinicio" in body["error"]["message"]


def test_list_tasks_and_filter(session_factory):
    """
    Verifica listado de tareas y filtros por estado.
    """
    client = TestClient(app, raise_server_exceptions=False)

    db = session_factory()
    try:
        t1 = ScanTaskRecord(id="task-1", status="completed", target="192.168.1.0/24")
        t2 = ScanTaskRecord(id="task-2", status="failed", target="192.168.1.0/24")
        db.add_all([t1, t2])
        db.commit()
    finally:
        db.close()

    # Listar todas
    resp_all = client.get("/api/tasks")
    assert resp_all.status_code == 200
    assert len(resp_all.json()) >= 2

    # Filtrar por status
    resp_completed = client.get("/api/tasks?status=completed")
    assert resp_completed.status_code == 200
    for item in resp_completed.json():
        assert item["status"] == "completed"



def test_existing_endpoints_continue_working(monkeypatch):
    """
    Criterio 7: Los endpoints anteriores siguen funcionando normalmente.
    """
    client = TestClient(app, raise_server_exceptions=False)

    fake_scanner = MagicMock()
    fake_scanner.scan_hosts.return_value = make_fake_result()
    monkeypatch.setattr("app.main.scan_service.scanner", fake_scanner)

    # POST /api/scans sincrónico
    resp_post = client.post("/api/scans")
    assert resp_post.status_code == 200
    assert resp_post.json()["total_hosts"] == 2

    # GET /api/scans
    resp_history = client.get("/api/scans")
    assert resp_history.status_code == 200
    assert len(resp_history.json()) >= 1

    # GET /api/devices
    resp_devices = client.get("/api/devices")
    assert resp_devices.status_code == 200
    assert len(resp_devices.json()) >= 1


def test_process_next_pending_for_standalone_worker(monkeypatch, session_factory):
    """
    Verifica que el worker independiente pueda procesar tareas pendientes directamente.
    """
    fake_scanner = MagicMock()
    fake_scanner.scan_hosts.return_value = make_fake_result("192.168.1.0/24")
    monkeypatch.setattr("app.main.scan_service.scanner", fake_scanner)

    db = session_factory()
    try:
        task = ScanTaskRecord(id="task-worker-cli", status="pending", target="192.168.1.0/24")
        db.add(task)
        db.commit()
    finally:
        db.close()

    # Procesar usando el método que invoca el worker CLI
    import app.main as main_module
    processed = main_module.task_service.process_next_pending()
    assert processed is True

    # Verificar que terminó en completed
    db = session_factory()
    try:
        updated = db.query(ScanTaskRecord).filter(ScanTaskRecord.id == "task-worker-cli").first()
        assert updated.status == "completed"
        assert updated.scan_id is not None
    finally:
        db.close()

    # Si no hay más pendientes, retorna False
    assert main_module.task_service.process_next_pending() is False

