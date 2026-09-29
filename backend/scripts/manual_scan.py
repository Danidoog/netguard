"""
Script manual para probar el scanner contra la red real.
NO es un test. Correr con:  python scripts/manual_scan.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.scanners.nmap_scanner import NmapScanner
from app.services.scan_service import ScanService


def main():
    scanner = NmapScanner()
    service = ScanService(scanner)
    result = service.scan_network()

    print(
        f"Red escaneada: {result.target} | "
        f"Hosts encontrados: {result.total_hosts} | "
        f"Duracion: {result.duration_seconds}s | "
        f"Hora: {result.scanned_at}"
    )
    print("=" * 100)

    for host in result.hosts:
        print(f"IP:          {host.ip}")
        print(f"Hostname:    {host.hostname}")
        print(f"MAC:         {host.mac}")
        print(f"Fabricante:  {host.vendor}")
        print(f"Estado:      {host.status}")
        print(f"Nombres:     {host.names}")
        print(f"Tipo:        {host.device_type}")
        print(f"OS:          {host.os_hint}")
        print(f"Modelo:      {host.model}")
        print(f"Servicios:   {host.services}")
        print(f"Puertos:     {host.open_ports}")
        print(f"Errores FP:  {host.fingerprint_errors}")
        print(f"Evidencia:   {host.evidence}")
        print("-" * 100)


if __name__ == "__main__":
    main()