import psutil
import socket
import ipaddress

from app.scanners.nmap_scanner import NmapScanner
from app.models.host import Host


def get_local_network() -> str:
    """Detecta automáticamente la red local (CIDR) de la interfaz activa."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # no envía nada real, solo resuelve la ruta
        local_ip = s.getsockname()[0]
    finally:
        s.close()

    for iface, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family == socket.AF_INET and addr.address == local_ip:
                network = ipaddress.IPv4Network(
                    f"{local_ip}/{addr.netmask}", strict=False
                )
                return str(network)

    raise RuntimeError("No se pudo determinar la red local.")


class ScanService:
    def __init__(self, scanner: NmapScanner):
        self.scanner = scanner

    def scan_network(self) -> list[Host]:
        target = get_local_network()
        return self.scanner.scan_hosts(target)