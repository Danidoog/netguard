"""
Pruebas de la capa de manejo de errores.

Cada test SIMULA la condición de falla (mockeando shutil.which,
subprocess.run, etc.) en vez de depender de que Nmap realmente falte o la
red esté caída de verdad. Esto hace las pruebas rápidas, deterministas y
ejecutables en cualquier máquina (CI incluido, donde puede que ni siquiera
haya Nmap instalado).

Correr con:  pytest tests/test_error_handling.py -v
"""
import subprocess
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.scanners.nmap_scanner import NmapScanner
from app.core.exceptions import (
    InvalidTargetError,
    NmapNotFoundError,
    ScanFailedError,
    ScanTimeoutError,
)


client = TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------
# 1. NMAP_NOT_FOUND (500)
# ---------------------------------------------------------------------
def test_nmap_not_found_returns_500():
    with patch("app.scanners.nmap_scanner.shutil.which", return_value=None):
        scanner = NmapScanner()  # se crea con nmap_path=None
        with pytest.raises(NmapNotFoundError) as exc_info:
            scanner.scan_hosts(target="192.168.1.0/24")

        assert exc_info.value.code == "NMAP_NOT_FOUND"
        assert exc_info.value.http_status == 500


def test_nmap_not_found_via_http_endpoint():
    # Sustituimos el scanner global de la app por uno sin nmap_path
    import app.main as main_module
    original_scanner = main_module.scan_service.scanner

    broken_scanner = NmapScanner.__new__(NmapScanner)  # sin correr __init__
    broken_scanner.nmap_path = None
    broken_scanner._own_ip = "10.10.0.87"

    main_module.scan_service.scanner = broken_scanner
    try:
        resp = client.post("/api/scans")
        assert resp.status_code == 500
        body = resp.json()
        assert body["error"]["code"] == "NMAP_NOT_FOUND"
    finally:
        main_module.scan_service.scanner = original_scanner  # restaurar


# ---------------------------------------------------------------------
# 2. INVALID_TARGET (400)
# ---------------------------------------------------------------------
def test_invalid_target_raises_error():
    with patch("app.scanners.nmap_scanner.shutil.which", return_value="/usr/bin/nmap"):
        scanner = NmapScanner()
        with pytest.raises(InvalidTargetError) as exc_info:
            scanner._validate_target("esto-no-es-una-red")

        assert exc_info.value.code == "INVALID_TARGET"
        assert exc_info.value.http_status == 400


def test_valid_targets_do_not_raise():
    with patch("app.scanners.nmap_scanner.shutil.which", return_value="/usr/bin/nmap"):
        scanner = NmapScanner()
        # No debe lanzar excepción para targets válidos
        scanner._validate_target("192.168.1.0/24")
        scanner._validate_target("10.0.0.1")


# ---------------------------------------------------------------------
# 3. SCAN_TIMEOUT (504)
# ---------------------------------------------------------------------
def test_scan_timeout_returns_504():
    with patch("app.scanners.nmap_scanner.shutil.which", return_value="/usr/bin/nmap"):
        scanner = NmapScanner()

        with patch(
            "app.scanners.nmap_scanner.subprocess.run",
            side_effect=subprocess.TimeoutExpired(cmd="nmap", timeout=120),
        ):
            with pytest.raises(ScanTimeoutError) as exc_info:
                scanner.scan_hosts(target="192.168.1.0/24")

            assert exc_info.value.code == "SCAN_TIMEOUT"
            assert exc_info.value.http_status == 504


# ---------------------------------------------------------------------
# 4. SCAN_FAILED (500) — Nmap corre pero termina con error
# ---------------------------------------------------------------------
def test_scan_failed_when_nmap_errors():
    with patch("app.scanners.nmap_scanner.shutil.which", return_value="/usr/bin/nmap"):
        scanner = NmapScanner()

        fake_error = subprocess.CalledProcessError(
            returncode=1, cmd="nmap", stderr="permission denied"
        )
        with patch(
            "app.scanners.nmap_scanner.subprocess.run", side_effect=fake_error
        ):
            with pytest.raises(ScanFailedError) as exc_info:
                scanner.scan_hosts(target="192.168.1.0/24")

            assert exc_info.value.code == "SCAN_FAILED"
            assert exc_info.value.http_status == 500
            assert "permission denied" in exc_info.value.message


# ---------------------------------------------------------------------
# 5. INTERNAL_ERROR (500) — excepción totalmente inesperada
# ---------------------------------------------------------------------
def test_unhandled_exception_returns_internal_error():
    import app.main as main_module
    original_scanner = main_module.scan_service.scanner

    # Un scanner cuyo scan_hosts lanza un error que NO es un NetGuardError
    broken_scanner = MagicMock()
    broken_scanner.scan_hosts.side_effect = ValueError("algo totalmente inesperado")

    main_module.scan_service.scanner = broken_scanner
    try:
        resp = client.post("/api/scans")
        assert resp.status_code == 500
        body = resp.json()
        assert body["error"]["code"] == "INTERNAL_ERROR"
        # El mensaje al cliente NUNCA debe filtrar el detalle interno
        assert "algo totalmente inesperado" not in body["error"]["message"]
    finally:
        main_module.scan_service.scanner = original_scanner