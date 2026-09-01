from dataclasses import asdict

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.exceptions import NetGuardError
from app.scanners.nmap_scanner import NmapScanner
from app.services.scan_service import ScanService


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