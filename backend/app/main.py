from dataclasses import asdict

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.exceptions import NetGuardError
from app.scanners.nmap_scanner import NmapScanner
from app.services.scan_service import ScanService

# Importaciones usadas para la base de datos
from app.core.database import engine, Base, SessionLocal
from app.db.models import ScanRecord, DeviceRecord

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="NetGuard API",
    version="0.1.0",
)

scanner = NmapScanner()
scan_service = ScanService(scanner)


class DeviceUpdate(BaseModel):
    alias: str | None = None
    trusted: bool | None = None


def _host_to_dict(h) -> dict:
    """
    Serializa un HostRecord (o Host) a JSON. Centralizado para que
    /api/scans, /api/scans/{id}/hosts y cualquier endpoint futuro
    devuelvan exactamente los mismos campos.
    """
    return {
        "ip": h.ip,
        "hostname": h.hostname,
        "mac": h.mac,
        "vendor": h.vendor,
        "status": h.status,
        "names": h.names or [],
        "services": h.services or [],
        "open_ports": h.open_ports or [],
        "model": h.model,
        "device_type": h.device_type,
        "os_hint": h.os_hint,
    }


def _device_to_dict(d: DeviceRecord) -> dict:
    return {
        "mac": d.mac,
        "alias": d.alias,
        "trusted": d.trusted,
        "last_ip": d.last_ip,
        "last_hostname": d.last_hostname,
        "vendor": d.vendor,
        "device_type": d.device_type,
        "os_hint": d.os_hint,
        "first_seen": d.first_seen,
        "last_seen": d.last_seen,
        "is_present": d.is_present,
        "is_new": d.first_seen == d.last_seen,
    }


@app.exception_handler(NetGuardError)
async def netguard_error_handler(request: Request, exc: NetGuardError):
    """
    Convierte cualquier excepción propia de NetGuard (InvalidTargetError,
    NmapNotFoundError, ScanTimeoutError, ScanFailedError, etc.) en una
    respuesta HTTP con el status y código correctos, sin repetir
    try/except en cada endpoint.
    """
    return JSONResponse(
        status_code=exc.http_status,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Red de seguridad: cualquier excepción que NO hayamos anticipado y
    convertido en un NetGuardError cae aquí. Nunca se expone el detalle
    interno al cliente (podría filtrar información del servidor); solo
    se registra en el log del servidor para depuración.
    
    [CALIDAD] ISO IEC 25010 · Seguridad (no filtra detalles internos) |
    ISO/IEC · 25010 Fiabilidad   
    """
    print(f"[UNHANDLED ERROR] {type(exc).__name__}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Ocurrió un error inesperado en el servidor.",
            }
        },
    )


@app.get("/")
def root():
    return {
        "application": "NetGuard",
        "status": "online",
    }


@app.post("/api/scans")
def scan_network():
    result = scan_service.scan_network()
    return asdict(result)


@app.get("/api/scans")
def get_scan_history():
    db = SessionLocal()
    try:
        scans = (
            db.query(ScanRecord)
            .order_by(ScanRecord.id.desc())
            .all()
        )
        return [
            {
                "id": s.id,
                "target": s.target,
                "total_hosts": s.total_hosts,
                "duration_seconds": s.duration_seconds,
                "scanned_at": s.scanned_at,
                "hosts": [_host_to_dict(h) for h in s.hosts],
            }
            for s in scans
        ]
    finally:
        db.close()


@app.get("/api/scans/{scan_id}")
def get_scan_detail(scan_id: int):
    db = SessionLocal()
    try:
        scan = db.query(ScanRecord).filter(ScanRecord.id == scan_id).first()
        if scan is None:
            raise HTTPException(
                status_code=404,
                detail=f"Escaneo con el ID {scan_id} no encontrado.",
            )

        return {
            "id": scan.id,
            "target": scan.target,
            "total_hosts": scan.total_hosts,
            "duration_seconds": scan.duration_seconds,
            "scanned_at": scan.scanned_at,
        }
    finally:
        db.close()


@app.get("/api/scans/{scan_id}/hosts")
def get_scan_hosts(scan_id: int):
    db = SessionLocal()
    try:
        scan = db.query(ScanRecord).filter(ScanRecord.id == scan_id).first()
        if scan is None:
            raise HTTPException(
                status_code=404,
                detail=f"Escaneo con el ID {scan_id} no encontrado",
            )

        return [_host_to_dict(h) for h in scan.hosts]
    finally:
        db.close()


@app.get("/api/devices")
def get_devices():
    db = SessionLocal()
    try:
        devices = (
            db.query(DeviceRecord)
            .order_by(DeviceRecord.last_seen.desc())
            .all()
        )
        return [_device_to_dict(d) for d in devices]
    finally:
        db.close()


@app.patch("/api/devices/{mac}")
def update_device(mac: str, update: DeviceUpdate):
    db = SessionLocal()
    try:
        device = db.query(DeviceRecord).filter(DeviceRecord.mac == mac).first()
        if device is None:
            raise HTTPException(
                status_code=404,
                detail=f"Dispositivo con MAC {mac} no encontrado.",
            )

        if update.alias is not None:
            device.alias = update.alias
        if update.trusted is not None:
            device.trusted = update.trusted

        db.commit()
        db.refresh(device)
        return _device_to_dict(device)
    finally:
        db.close()