"""
Worker independiente para procesar tareas de escaneo de NetGuard fuera del servidor web.
Uso:
    python -m app.worker
o desde backend/:
    python app/worker.py
"""
import logging
import signal
import sys
import time
from pathlib import Path

# Asegurar que el directorio raíz de backend esté en sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.core.database import Base, engine
from app.scanners.nmap_scanner import NmapScanner
from app.services.scan_service import ScanService
from app.services.task_service import TaskService

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [NetGuard-Worker] %(message)s",
)
logger = logging.getLogger("netguard-worker")

_RUNNING = True


def _handle_exit(sig, frame):
    global _RUNNING
    logger.info("Señal de parada recibida (%s). Finalizando worker limpiamente...", sig)
    _RUNNING = False


def main():
    signal.signal(signal.SIGINT, _handle_exit)
    signal.signal(signal.SIGTERM, _handle_exit)

    Base.metadata.create_all(bind=engine)

    scanner = NmapScanner()
    scan_service = ScanService(scanner)
    task_service = TaskService(scan_service, max_workers=1)

    interrupted = task_service.recover_interrupted_tasks()
    if interrupted > 0:
        logger.warning("Se recuperaron %d tareas interrumpidas en el inicio.", interrupted)

    logger.info("Worker de NetGuard iniciado. Esperando tareas en la base de datos...")

    while _RUNNING:
        try:
            processed = task_service.process_next_pending()
            if not processed:
                time.sleep(2)
        except Exception as e:
            logger.error("Error no controlado en el bucle del worker: %s", e)
            time.sleep(3)

    task_service.shutdown(wait=True)
    logger.info("Worker detenido correctamente.")


if __name__ == "__main__":
    main()
