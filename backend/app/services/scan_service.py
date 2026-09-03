from app.scanners.nmap_scanner import NmapScanner
from app.models.scan_result import ScanResult
from app.core.database import SessionLocal
from app.db.models import ScanRecord, HostRecord

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
                    scan_id= scan_record.id,
                    ip=host.ip,
                    hostname=host.hostname,
                    mac=host.mac,
                    vendor=host.vendor,
                    status=host.status,
                ))
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
