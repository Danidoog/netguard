from app.scanners.nmap_scanner import NmapScanner
from app.models.host import Host


class ScanService:

    def __init__(self, scanner: NmapScanner):
        self.scanner = scanner

    def scan_network(self, target: str) -> list[Host]:
        return self.scanner.scan_hosts(target)