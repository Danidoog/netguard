from app.scanners.nmap_scanner import NmapScanner
from app.services.scan_service import ScanService


scanner = NmapScanner()
service = ScanService(scanner)

result = service.scan_network()

print(
    f"Red escaneada: {result.target} | "
    f"Hosts encontrados: {result.total_hosts} | "
    f"Duración: {result.duration_seconds}s | "
    f"Hora: {result.scanned_at}"
)
print("-" * 60)

for host in result.hosts:
    print(
        f"IP: {host.ip} | "
        f"Hostname: {host.hostname} | "
        f"MAC: {host.mac} | "
        f"Fabricante: {host.vendor} | "
        f"Estado: {host.status}"
    )