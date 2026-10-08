from app.scanners.nmap_scanner import NmapScanner
from app.models.scan_result import ScanResult
from app.core.database import SessionLocal
from app.db.models import ScanRecord, HostRecord, DeviceRecord


class ScanService:
    def __init__(self, scanner: NmapScanner):
        self.scanner = scanner

    def scan_network(self) -> ScanResult:
        result = self.scanner.scan_hosts()
        self._save_to_db(result)
        return result

    def _save_to_db(self, result: ScanResult):
        db = SessionLocal()
        try:
            scan_record = ScanRecord(
                target=result.target,
                total_hosts=result.total_hosts,
                duration_seconds=result.duration_seconds,
                scanned_at=result.scanned_at,
            )
            db.add(scan_record)
            db.flush()

            for host in result.hosts:
                db.add(HostRecord(
                    scan_id=scan_record.id,
                    ip=host.ip,
                    hostname=host.hostname,
                    mac=host.mac,
                    vendor=host.vendor,
                    status=host.status,
                    names=list(host.names or []),
                    services=list(host.services or []),
                    open_ports=list(host.open_ports or []),
                    model=host.model,
                    device_type=host.device_type,
                    os_hint=host.os_hint,
                    evidence=list(host.evidence or []),
                ))

            self._upsert_devices(db, result)

            db.commit()
        except Exception:
            # [CALIDAD] ISO/IEC 25010 · Fiabilidad: rollback de la transacción en caso de error 
            # para mantener la consistencia de la base de datos.
            db.rollback()
            raise
        finally:
            db.close()

    def _upsert_devices(self, db, result: ScanResult) -> None:
        """
        Crea o actualiza DeviceRecord por MAC para cada host del escaneo,
        y marca como ausentes (is_present=False) los dispositivos conocidos
        que no aparecieron en este escaneo.
        """
        seen_macs: set[str] = set()

        for host in result.hosts:
            if not host.mac:
                continue  # sin MAC no podemos identificar el dispositivo de forma estable
            seen_macs.add(host.mac)

            device = db.query(DeviceRecord).filter(
                DeviceRecord.mac == host.mac
            ).first()

            if device is None:
                db.add(DeviceRecord(
                    mac=host.mac,
                    last_ip=host.ip,
                    last_hostname=host.hostname,
                    vendor=host.vendor,
                    device_type=host.device_type,
                    os_hint=host.os_hint,
                    first_seen=result.scanned_at,
                    last_seen=result.scanned_at,
                    is_present=True,
                ))
            else:
                device.last_ip = host.ip
                device.last_seen = result.scanned_at
                device.is_present = True
                if host.hostname:
                    device.last_hostname = host.hostname
                if host.vendor and host.vendor not in ("Desconocido",):
                    device.vendor = host.vendor
                if host.device_type:
                    device.device_type = host.device_type
                if host.os_hint:
                    device.os_hint = host.os_hint

        db.query(DeviceRecord).filter(
            DeviceRecord.mac.notin_(seen_macs) if seen_macs else True,
            DeviceRecord.is_present == True,
        ).update({"is_present": False}, synchronize_session=False)