import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.exceptions import (
    NetGuardError,
    ScanAlreadyRunningError,
    TaskNotFoundError,
)
from app.db.models import ScanTaskRecord, SchedulerConfigRecord
from app.services.scan_service import ScanService


class TaskService:
    """
    Servicio de orquestación y ciclo de vida de tareas en segundo plano.
    Maneja la creación, persistencia, prevención de duplicados,
    ejecución asíncrona y recuperación ante reinicios.
    """

    def __init__(self, scan_service: ScanService, max_workers: int = 1):
        self.scan_service = scan_service
        self.executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="netguard-worker",
        )

    def create_task(self, target: str | None = None) -> ScanTaskRecord:
        """
        Registra una nueva tarea de escaneo en la base de datos y la encola
        para su ejecución en segundo plano sin bloquear.
        """
        # Validación temprana del objetivo si se proporcionó uno
        if target:
            target = target.strip()
            # Valida el formato del objetivo usando el scanner existente
            self.scan_service.scanner._validate_target(target)
        else:
            target = None

        db = SessionLocal()
        try:
            # Control de concurrencia: evitar múltiples escaneos idénticos o simultáneos
            active_task = (
                db.query(ScanTaskRecord)
                .filter(
                    ScanTaskRecord.status.in_(["pending", "running"]),
                )
                .first()
            )

            if active_task is not None:
                raise ScanAlreadyRunningError(
                    f"Ya existe una tarea de escaneo activa (ID: {active_task.id}, estado: '{active_task.status}'). "
                    "Espere a que finalice antes de iniciar otra."
                )

            task_id = str(uuid.uuid4())
            task = ScanTaskRecord(
                id=task_id,
                target=target,
                status="pending",
            )
            db.add(task)
            db.commit()
            db.refresh(task)

            # Encolar en el ejecutor en segundo plano
            self.executor.submit(self._execute_task, task_id)
            return task
        finally:
            db.close()

    def get_task(self, task_id: str) -> ScanTaskRecord:
        """
        Consulta una tarea por su identificador.
        """
        db = SessionLocal()
        try:
            task = (
                db.query(ScanTaskRecord)
                .filter(ScanTaskRecord.id == task_id)
                .first()
            )
            if task is None:
                raise TaskNotFoundError(f"Tarea con ID '{task_id}' no encontrada.")
            # Aseguramos carga de la relación scan antes de cerrar sesión
            _ = task.scan
            return task
        finally:
            db.close()

    def list_tasks(
        self,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[ScanTaskRecord]:
        """
        Lista tareas registradas con filtros opcionales.
        """
        db = SessionLocal()
        try:
            query = db.query(ScanTaskRecord)
            if status:
                query = query.filter(ScanTaskRecord.status == status)
            tasks = (
                query.order_by(ScanTaskRecord.created_at.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
            for t in tasks:
                _ = t.scan
            return tasks
        finally:
            db.close()

    def _execute_task(self, task_id: str) -> None:
        """
        Ejecución real de la tarea por el worker en segundo plano.
        Actualiza el estado de la tarea en cada transición y garantiza
        el cierre de sesiones y el registro de errores.
        """
        db = SessionLocal()
        try:
            task = (
                db.query(ScanTaskRecord)
                .filter(ScanTaskRecord.id == task_id)
                .first()
            )
            if task is None or task.status != "pending":
                return

            task.status = "running"
            task.started_at = datetime.now(timezone.utc)
            db.commit()

            # Ejecución del escáner existente
            try:
                result = self.scan_service.scan_network(target=task.target)
                task.status = "completed"
                task.finished_at = datetime.now(timezone.utc)
                task.scan_id = result.id

                # Sincroniza la marca de último escaneo en el programador
                sched_cfg = (
                    db.query(SchedulerConfigRecord)
                    .filter(SchedulerConfigRecord.id == 1)
                    .first()
                )
                if sched_cfg:
                    sched_cfg.last_run_at = task.finished_at

                db.commit()
            except NetGuardError as exc:
                task.status = "failed"
                task.finished_at = datetime.now(timezone.utc)
                task.error_code = exc.code
                task.error_message = exc.message
                db.commit()
            except Exception as exc:
                task.status = "failed"
                task.finished_at = datetime.now(timezone.utc)
                task.error_code = "INTERNAL_ERROR"
                task.error_message = f"Error inesperado durante la ejecución: {exc}"
                db.commit()
        finally:
            db.close()

    def recover_interrupted_tasks(self) -> int:
        """
        Limpia tareas interrumpidas por apagados o reinicios del servidor.
        Cualquier tarea en estado 'running' al arrancar el servidor se marca
        como 'failed' con una descripción clara, y las tareas 'pending' se encolan.
        """
        db = SessionLocal()
        interrupted_count = 0
        try:
            running_tasks = (
                db.query(ScanTaskRecord)
                .filter(ScanTaskRecord.status == "running")
                .all()
            )
            for task in running_tasks:
                task.status = "failed"
                task.finished_at = datetime.now(timezone.utc)
                task.error_code = "SERVER_RESTARTED"
                task.error_message = (
                    "La tarea fue interrumpida por un reinicio o apagado del servidor."
                )
                interrupted_count += 1

            pending_tasks = (
                db.query(ScanTaskRecord)
                .filter(ScanTaskRecord.status == "pending")
                .all()
            )
            db.commit()

            # Encolar las pendientes que quedaron
            for task in pending_tasks:
                self.executor.submit(self._execute_task, task.id)

            return interrupted_count
        finally:
            db.close()

    def process_next_pending(self) -> bool:
        """
        Procesa la siguiente tarea pendiente en la BD (utilizado por el worker CLI independiente).
        Retorna True si procesó una tarea, False si no había pendientes.
        """
        db = SessionLocal()
        task_id = None
        try:
            pending = (
                db.query(ScanTaskRecord)
                .filter(ScanTaskRecord.status == "pending")
                .order_by(ScanTaskRecord.created_at.asc())
                .first()
            )
            if pending:
                task_id = pending.id
        finally:
            db.close()

        if task_id:
            self._execute_task(task_id)
            return True
        return False

    def shutdown(self, wait: bool = False) -> None:
        """
        Apaga el executor de hilos.
        """
        self.executor.shutdown(wait=wait)


def _to_utc_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def task_to_dict(task: ScanTaskRecord) -> dict:
    """
    Serializa un ScanTaskRecord a formato dict para respuestas JSON uniformes.
    No inventa porcentajes; retorna estado real y metadatos.
    """
    data = {
        "id": task.id,
        "target": task.target,
        "status": task.status,
        "created_at": _to_utc_iso(task.created_at),
        "started_at": _to_utc_iso(task.started_at),
        "finished_at": _to_utc_iso(task.finished_at),
        "scan_id": task.scan_id,
        "result": None,
        "error": None,
    }

    if task.error_code or task.error_message:
        data["error"] = {
            "code": task.error_code or "ERROR",
            "message": task.error_message or "",
        }

    if task.scan_id is not None:
        try:
            scan = task.scan
            if scan is not None:
                data["result"] = {
                    "id": scan.id,
                    "target": scan.target,
                    "total_hosts": scan.total_hosts,
                    "duration_seconds": scan.duration_seconds,
                    "scanned_at": scan.scanned_at,
                }
        except Exception:
            pass

    return data

