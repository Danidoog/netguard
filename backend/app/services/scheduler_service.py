import logging
import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.exceptions import InvalidTargetError
from app.db.models import ScanRecord, ScanTaskRecord, SchedulerConfigRecord
from app.services.task_service import TaskService

logger = logging.getLogger("netguard-scheduler")


_UNSET = object()


def _to_utc_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


class SchedulerService:
    """
    Servicio encargado de orquestar y ejecutar escaneos de red periódicos
    en segundo plano de acuerdo con la configuración persistida en base de datos.
    """

    def __init__(self, task_service: TaskService, check_interval_seconds: float = 5.0):
        self.task_service = task_service
        self.check_interval_seconds = check_interval_seconds
        self._running = False
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def _get_or_create_config(self, db: Session) -> SchedulerConfigRecord:
        config = (
            db.query(SchedulerConfigRecord)
            .filter(SchedulerConfigRecord.id == 1)
            .first()
        )
        if config is None:
            config = SchedulerConfigRecord(
                id=1,
                enabled=False,
                interval_minutes=30,
                target=None,
                last_run_at=None,
            )
            db.add(config)
            db.commit()
            db.refresh(config)
        return config

    def _resolve_latest_run(self, db: Session, config: SchedulerConfigRecord) -> datetime | None:
        """
        Determina la fecha y hora UTC más reciente en la que se realizó un escaneo,
        consultando tanto scheduler_config.last_run_at como la tabla de escaneos (scans).
        """
        latest = config.last_run_at
        if latest and latest.tzinfo is None:
            latest = latest.replace(tzinfo=timezone.utc)

        last_scan = (
            db.query(ScanRecord)
            .order_by(ScanRecord.id.desc())
            .first()
        )
        if last_scan and last_scan.created_at:
            scan_time = (
                last_scan.created_at.replace(tzinfo=timezone.utc)
                if last_scan.created_at.tzinfo is None
                else last_scan.created_at
            )
            if latest is None or scan_time > latest:
                latest = scan_time

        return latest

    def get_config(self) -> dict:
        """
        Retorna la configuración actual del programador de escaneos con
        marcas de tiempo UTC consistentes para evitar discrepancias de zona horaria.
        """
        db = SessionLocal()
        try:
            config = self._get_or_create_config(db)
            now = datetime.now(timezone.utc)

            latest_run = self._resolve_latest_run(db, config)

            next_run = None
            if config.enabled:
                if latest_run is None:
                    next_run = now
                else:
                    calculated_next = latest_run + timedelta(minutes=config.interval_minutes)
                    # Si el cálculo da una fecha ya transcurrida, el próximo escaneo vence ahora
                    next_run = calculated_next if calculated_next > now else now

            return {
                "enabled": config.enabled,
                "interval_minutes": config.interval_minutes,
                "target": config.target,
                "last_run_at": _to_utc_iso(latest_run),
                "next_run_at": _to_utc_iso(next_run),
                "updated_at": _to_utc_iso(config.updated_at),
                "scheduler_running": self._running,
            }
        finally:
            db.close()

    def update_config(
        self,
        enabled: bool | None = None,
        interval_minutes: int | None = None,
        target: str | None | object = _UNSET,
    ) -> dict:
        """
        Actualiza los parámetros de escaneo periódico en la base de datos.
        """
        if interval_minutes is not None and interval_minutes < 1:
            raise InvalidTargetError("El intervalo de escaneo debe ser de al menos 1 minuto.")

        if target is not _UNSET:
            if target is not None:
                target = target.strip()
                if target == "" or target.lower() == "auto":
                    target = None
                else:
                    self.task_service.scan_service.scanner._validate_target(target)

        db = SessionLocal()
        try:
            config = self._get_or_create_config(db)
            if enabled is not None:
                config.enabled = enabled
            if interval_minutes is not None:
                config.interval_minutes = interval_minutes
            if target is not _UNSET:
                config.target = target

            db.commit()
            db.refresh(config)
        finally:
            db.close()

        return self.get_config()

    def check_and_trigger_due_scan(self) -> bool:
        """
        Comprueba si corresponde disparar un escaneo periódico y, si es así,
        crea la tarea en segundo plano. Retorna True si se disparó una tarea.
        """
        db = SessionLocal()
        try:
            config = self._get_or_create_config(db)
            if not config.enabled:
                return False

            now = datetime.now(timezone.utc)
            is_due = False

            latest_run = self._resolve_latest_run(db, config)
            if latest_run is None:
                is_due = True
            elif now >= latest_run + timedelta(minutes=config.interval_minutes):
                is_due = True

            if not is_due:
                return False

            # Verificar que no haya un escaneo activo antes de crear uno nuevo
            active_task = (
                db.query(ScanTaskRecord)
                .filter(ScanTaskRecord.status.in_(["pending", "running"]))
                .first()
            )
            if active_task is not None:
                # Ya hay uno en curso; no disparamos otro ahora
                return False

            # Actualizamos last_run_at y creamos la tarea
            config.last_run_at = now
            db.commit()

            try:
                self.task_service.create_task(target=config.target)
                return True
            except Exception as e:
                logger.error("Error al disparar escaneo periódico: %s", e)
                return False
        finally:
            db.close()

    def _loop(self) -> None:
        """
        Bucle en segundo plano que periódicamente evalúa si corresponde
        ejecutar un escaneo.
        """
        while not self._stop_event.is_set():
            try:
                self.check_and_trigger_due_scan()
            except Exception as e:
                logger.error("Excepción en el bucle del scheduler: %s", e)

            # Espera segura verificando el stop event periódicamente
            self._stop_event.wait(timeout=self.check_interval_seconds)

    def start(self) -> None:
        """
        Inicia el hilo del planificador periódico.
        """
        if self._running:
            return

        self._running = True
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._loop,
            daemon=True,
            name="netguard-scheduler-loop",
        )
        self._thread.start()
        logger.info("Planificador de escaneos periódicos iniciado.")

    def stop(self, timeout: float = 2.0) -> None:
        """
        Detiene el hilo del planificador de forma limpia.
        """
        if not self._running:
            return

        self._running = False
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=timeout)
        self._thread = None
        logger.info("Planificador de escaneos periódicos detenido.")
