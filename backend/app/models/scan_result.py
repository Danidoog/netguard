from dataclasses import dataclass

from app.models.host import Host


@dataclass
class ScanResult:
    target: str              # CIDR de la red escaneada (ej: "10.10.0.0/20")
    hosts: list[Host]        # Hosts encontrados como 'up'
    total_hosts: int         # len(hosts)
    duration_seconds: float  # Cuánto tardó el escaneo
    scanned_at: str          # Timestamp ISO UTC de cuándo se escaneó