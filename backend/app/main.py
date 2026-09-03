from dataclasses import asdict

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.exceptions import NetGuardError
from app.scanners.nmap_scanner import NmapScanner
from app.services.scan_service import ScanService

#Importaciones usados para la base de datos
from app.core.database import engine, Base
from app.models import scan_result
from app.core.database import SessionLocal
from app.db.models import ScanRecord
from fastapi import HTTPException
from app.core.database import SessionLocal
from app.db.models import ScanRecord
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="NetGuard API",
    version="0.1.0"
)

scanner = NmapScanner()
scan_service = ScanService(scanner)


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
        "status": "online"
    }


@app.post("/api/scans")
def scan_network():
    result = scan_service.scan_network()
    return asdict(result)

@app.get("/api/scans")
def get_scan_history():
    db = SessionLocal()

    try:
        scans = db.query(ScanRecord).all()
        return [
            {
                "id": s.id,
                "target": s.target,
                "total_hosts": s.total_hosts,
                "duration_seconds": s.duration_seconds,
                "scanned_at": s.scanned_at,
                "hosts": [
                    {"ip": h.ip, "hostname": h.hostname, "mac": h.mac, "vendor": h.vendor, "status": h.status}
                    for h in s.hosts
                ],
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
            raise HTTPException(status_code=404, detail=f"Escaneo con el ID {scan_id} no encontrado.")

        return{
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
            raise HTTPException(status_code=404, detail=f"Escaneo con el ID {scan_id} no encontrado")

        return[
            {
                "ip": h.ip,
                "hostname": h.hostname,
                "mac": h.mac,
                "vendor": h.vendor,
                "status": h.status,
            }
            for h in scan.hosts
        ]
    finally: 
        db.close()