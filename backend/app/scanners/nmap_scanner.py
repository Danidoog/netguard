import platform
import shutil
import socket
import subprocess
import xml.etree.ElementTree as ET
import psutil
from getmac import get_mac_address
from mac_vendor_lookup import MacLookup, VendorNotFoundError

from app.models.host import Host


class NmapScanner:

    def __init__(self):
        self.nmap_path = shutil.which("nmap")

        if self.nmap_path is None:
            raise RuntimeError(
                "Nmap no está instalado o no se encuentra en el PATH."
            )

        self.mac_lookup = MacLookup()
        try:
            # Descarga/actualiza la base de datos OUI (IEEE) una sola vez.
            # Si ya existe en caché local, esto es prácticamente instantáneo.
            self.mac_lookup.update_vendors()
        except Exception as e:
            # No se esconde el error: se imprime para poder diagnosticar
            # (sin internet, caché con permisos de otro usuario, etc.)
            print(f"[NmapScanner] No se pudo actualizar la base de "
                  f"fabricantes MAC: {type(e).__name__}: {e}")

        # IP propia de esta máquina, calculada una sola vez. Se usa para
        # detectar cuándo un host escaneado es la propia máquina (caso en
        # el que ARP nunca funciona, porque uno no se hace ARP a sí mismo).
        self._own_ip = self._detect_own_ip()

    def scan_hosts(self, target: str) -> list[Host]:
        command = [
           self.nmap_path,
           "-sn",
           "-PR",
           "-n",
           "-T4",
           "--max-retries", "2",
           "--host-timeout", "10s",
           "-oX",
           "-",
           target
        ]

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )

        return self._parse_hosts(result.stdout)

    def _is_locally_administered(self, mac: str) -> bool:
        """
        Detecta si una MAC es 'localmente administrada' (aleatoria/privada),
        típico de la aleatorización de MAC en celulares y laptops modernos
        (Android, iOS, Windows la usan por defecto al conectarse a redes
        nuevas). Estas MACs jamás tendrán fabricante real en la base OUI,
        así que no tiene caso ni siquiera buscarlas.
        """
        try:
            first_octet = int(mac.split(":")[0], 16)
            return bool(first_octet & 0b00000010)
        except (ValueError, IndexError):
            return False

    def _get_vendor(self, mac: str) -> str:
        """Busca el fabricante de una MAC en la base de datos OUI local."""
        if self._is_locally_administered(mac):
            return "No disponible (MAC privada/aleatoria)"

        try:
            return self.mac_lookup.lookup(mac)
        except VendorNotFoundError:
            return "Desconocido"
        except Exception:
            # Base de datos no descargada / MAC inválida / etc.
            return "Desconocido"

    def _detect_own_ip(self) -> str | None:
        """IP local de esta máquina en la red (no envía tráfico real)."""
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except OSError:
            return None
        finally:
            s.close()

    def _get_own_mac(self) -> str | None:
        """
        Lee la MAC de la interfaz local directamente del sistema operativo
        (vía psutil), en vez de por ARP. Necesario porque un host nunca
        tiene entrada ARP para su propia IP.
        """
        if self._own_ip is None:
            return None

        for iface, addrs in psutil.net_if_addrs().items():
            has_own_ip = any(
                a.family == socket.AF_INET and a.address == self._own_ip
                for a in addrs
            )
            if not has_own_ip:
                continue

            for a in addrs:
                if a.family == psutil.AF_LINK and a.address:
                    return a.address

        return None

    def _resolve_mac(self, ip: str) -> str | None:
        """
        Respaldo multiplataforma: intenta obtener la MAC vía la tabla ARP
        del sistema operativo. Si aún no está en caché (el host no ha tenido
        tráfico L2 reciente), se fuerza un ping -que dispara resolución ARP
        automáticamente en la subred local- y se reintenta una sola vez.

        Caso especial: si la IP es la de esta misma máquina, ARP nunca va
        a funcionar (uno no se hace ARP a sí mismo), así que se lee la MAC
        directamente de la interfaz de red local.
        """
        if self._own_ip is not None and ip == self._own_ip:
            return self._get_own_mac()

        mac = get_mac_address(ip=ip)
        if mac is not None:
            return mac

        is_windows = platform.system().lower() == "windows"
        ping_cmd = (
            ["ping", "-n", "1", "-w", "500", ip]
            if is_windows
            else ["ping", "-c", "1", "-W", "1", ip]
        )

        try:
            subprocess.run(
                ping_cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=2,
            )
        except (subprocess.TimeoutExpired, OSError):
            pass

        return get_mac_address(ip=ip)

    def _get_hostname(self, ip: str) -> str | None:
        """
        Intenta resolver el hostname vía DNS inverso (PTR).
        Se usa un timeout corto porque solo se llama para hosts que ya
        confirmamos que están 'up' (pocos), no para el rango completo.
        """
        original_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(1)
        try:
            hostname, _, _ = socket.gethostbyaddr(ip)
            return hostname
        except (socket.herror, socket.gaierror, socket.timeout, OSError):
            return None
        finally:
            socket.setdefaulttimeout(original_timeout)

    def _parse_hosts(self, xml_output: str) -> list[Host]:
        root = ET.fromstring(xml_output)

        hosts = []

        for host in root.findall("host"):
            status = host.find("status")

            if status is None or status.get("state") != "up":
                continue

            ip = None
            mac = None
            vendor = None

            for address in host.findall("address"):
                address_type = address.get("addrtype")

                if address_type == "ipv4":
                    ip = address.get("addr")

                elif address_type == "mac":
                    mac = address.get("addr")
                    vendor = address.get("vendor")

            if ip is None:
                continue

            # --- RESPALDO MULTIPLATAFORMA ---
            # Si Nmap no obtuvo la MAC (porque se ejecutó sin sudo/admin)
            if mac is None:
                mac = self._resolve_mac(ip)

            # Si tenemos MAC pero no fabricante (ya sea porque Nmap no lo
            # trajo, o porque la MAC vino del respaldo), lo buscamos
            # nosotros mismos con mac_vendor_lookup.
            if mac and not vendor:
                vendor = self._get_vendor(mac)

            hostname_element = host.find("./hostnames/hostname")

            hostname = None

            if hostname_element is not None:
                hostname = hostname_element.get("name")

            # Como usamos -n en Nmap, nunca llenará hostnames por su cuenta.
            # Lo resolvemos aquí, solo para hosts ya confirmados 'up'.
            if hostname is None:
                hostname = self._get_hostname(ip)

            hosts.append(
                Host(
                    ip=ip,
                    hostname=hostname,
                    mac=mac,
                    vendor=vendor,
                    status="up"
                )
            )

        return hosts