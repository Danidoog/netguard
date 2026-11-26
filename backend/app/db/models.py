from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ScanRecord(Base):
    """Escaneo completo, equivalente a ScanResult."""

    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, index=True)
    target = Column(String, nullable=False)
    total_hosts = Column(Integer, nullable=False)
    #[CALIDAD] ISO/IEC 25010 · Eficiencia: cada escaneo registra su duración (metrica ISO/IEC 25023)
    duration_seconds = Column(Float, nullable=False)
    scanned_at = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    hosts = relationship(
        "HostRecord", back_populates="scan", cascade="all, delete-orphan"
    )


class HostRecord(Base):
    """Host encontrado en un escaneo, equivalente a Host."""

    __tablename__ = "hosts"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("scans.id"), nullable=False)

    ip = Column(String, index=True, nullable=False)
    hostname = Column(String, nullable=True)
    mac = Column(String, nullable=True)
    vendor = Column(String, nullable=True)
    status = Column(String, default="up")

    # --- Fingerprinting ---
    names = Column(JSON, default=list)
    services = Column(JSON, default=list)
    open_ports = Column(JSON, default=list)
    model = Column(String, nullable=True)
    device_type = Column(String, nullable=True)
    os_hint = Column(String, nullable=True)
    evidence = Column(JSON, default=list)

    scan = relationship("ScanRecord", back_populates="hosts")


class DeviceRecord(Base):
    """
    Dispositivo único identificado por MAC. Persiste entre escaneos,
    a diferencia de HostRecord que es una foto de un escaneo puntual.
    """

    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    mac = Column(String, unique=True, index=True, nullable=False)

    # Editable por el usuario
    alias = Column(String, nullable=True)
    trusted = Column(Boolean, default=False, nullable=False)

    # Última info conocida (se actualiza en cada escaneo donde aparece)
    last_ip = Column(String, nullable=True)
    last_hostname = Column(String, nullable=True)
    vendor = Column(String, nullable=True)
    device_type = Column(String, nullable=True)
    os_hint = Column(String, nullable=True)

    # Presencia
    first_seen = Column(String, nullable=False)
    last_seen = Column(String, nullable=False)
    is_present = Column(Boolean, default=True, nullable=False)


class ScanTaskRecord(Base):
    """
    Tarea de escaneo en segundo plano. Persiste el ciclo de vida
    de la solicitud (pending -> running -> completed | failed),
    asociando el resultado del escaneo sin duplicar información.
    """

    __tablename__ = "scan_tasks"

    id = Column(String, primary_key=True, index=True)
    target = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    scan_id = Column(Integer, ForeignKey("scans.id"), nullable=True)
    error_code = Column(String, nullable=True)
    error_message = Column(String, nullable=True)

    scan = relationship("ScanRecord", lazy="joined")


class SchedulerConfigRecord(Base):
    """
    Configuración persistente para escaneos periódicos automáticos en segundo plano.
    """

    __tablename__ = "scheduler_config"

    id = Column(Integer, primary_key=True, default=1)
    enabled = Column(Boolean, default=False, nullable=False)
    interval_minutes = Column(Integer, default=30, nullable=False)
    target = Column(String, nullable=True)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())