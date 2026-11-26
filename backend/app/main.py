from contextlib import asynccontextmanager
from dataclasses import asdict

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.exceptions import NetGuardError, ScanAlreadyRunningError
from app.scanners.nmap_scanner import NmapScanner
from app.services.scan_service import ScanService
from app.services.task_service import TaskService, task_to_dict
from app.services.scheduler_service import SchedulerService, _UNSET

# Importaciones usadas para la base de datos
from app.core.database import engine, Base, SessionLocal
from app.db.models import ScanRecord, DeviceRecord, ScanTaskRecord, SchedulerConfigRecord

Base.metadata.create_all(bind=engine)

scanner = NmapScanner()
scan_service = ScanService(scanner)
task_service = TaskService(scan_service)
scheduler_service = SchedulerService(task_service)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Recupera tareas interrumpidas tras un reinicio del servidor
    task_service.recover_interrupted_tasks()
    scheduler_service.start()
    yield
    scheduler_service.stop()
    task_service.shutdown(wait=False)


app = FastAPI(
    title="NetGuard API",
    version="0.1.0",
    lifespan=lifespan,
)


class ScanTaskCreate(BaseModel):
    target: str | None = None


class SchedulerConfigUpdate(BaseModel):
    enabled: bool | None = None
    interval_minutes: int | None = None
    target: str | None = None




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
    db = SessionLocal()
    try:
        active_task = (
            db.query(ScanTaskRecord)
            .filter(ScanTaskRecord.status.in_(["pending", "running"]))
            .first()
        )
        if active_task:
            raise ScanAlreadyRunningError(
                f"Ya existe una tarea de escaneo activa (ID: {active_task.id}, estado: '{active_task.status}')."
            )
    finally:
        db.close()

    result = scan_service.scan_network()
    return asdict(result)


@app.post("/api/tasks/scans", status_code=status.HTTP_202_ACCEPTED)
@app.post("/api/scans/async", status_code=status.HTTP_202_ACCEPTED)
@app.post("/api/tasks", status_code=status.HTTP_202_ACCEPTED)
def create_scan_task(req: ScanTaskCreate | None = None):
    target = req.target if req else None
    task = task_service.create_task(target=target)
    return task_to_dict(task)


@app.get("/api/tasks/{task_id}")
@app.get("/api/scans/tasks/{task_id}")
def get_task_status(task_id: str):
    task = task_service.get_task(task_id)
    return task_to_dict(task)


@app.get("/api/tasks")
def list_tasks(status: str | None = None, limit: int = 50, offset: int = 0):
    tasks = task_service.list_tasks(status=status, limit=limit, offset=offset)
    return [task_to_dict(t) for t in tasks]


@app.get("/api/config/scheduler")
def get_scheduler_config():
    return scheduler_service.get_config()


@app.post("/api/config/scheduler")
@app.put("/api/config/scheduler")
def update_scheduler_config(update: SchedulerConfigUpdate):
    fields = update.model_dump(exclude_unset=True)
    return scheduler_service.update_config(
        enabled=fields.get("enabled"),
        interval_minutes=fields.get("interval_minutes"),
        target=fields["target"] if "target" in fields else _UNSET,
    )




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