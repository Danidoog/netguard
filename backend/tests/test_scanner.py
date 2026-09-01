from app.scanners.nmap_scanner import NmapScanner
from app.services.scan_service import ScanService


scanner = NmapScanner()
service = ScanService(scanner)

hosts = service.scan_network("192.168.1.0/24")

for host in hosts:
    print(
        f"IP: {host.ip} | "
        f"Hostname: {host.hostname} | "
        f"MAC: {host.mac} | "
        f"Fabricante: {host.vendor} | "
        f"Estado: {host.status}"
    )