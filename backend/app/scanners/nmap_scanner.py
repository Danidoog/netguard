import ipaddress
import platform
import re
import shutil
import socket
import struct
import subprocess
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone

import psutil
from getmac import get_mac_address
from mac_vendor_lookup import MacLookup, VendorNotFoundError

from app.core.exceptions import (
    InvalidTargetError,
    NmapNotFoundError,
    ScanFailedError,
    ScanTimeoutError,
)
from app.models.host import Host
from app.models.scan_result import ScanResult

# --- Imports opcionales (no rompen si faltan) ---
try:
    from zeroconf import ServiceBrowser, Zeroconf
    _HAS_ZEROCONF = True
except ImportError:
    _HAS_ZEROCONF = False


# Tiempo máximo (segundos) que se le da al proceso de Nmap completo antes
# de considerarlo "agotado". Es independiente del --host-timeout por host.
# [CALIDAD] ISO/IEC 25010 · Eficiencia de desempeño (limite de tiempo del escaneo) | IEEE 730 · Manejo de errores (tiempo de espera)
DEFAULT_SCAN_TIMEOUT_SECONDS = 120

# Puertos típicos para sondeo rápido. Lista corta a propósito.
COMMON_PORTS: tuple[int, ...] = (
    22,     # SSH
    53,     # DNS
    80,     # HTTP
    443,    # HTTPS
    445,    # SMB (Windows)
    548,    # AFP (macOS)
    554,    # RTSP (cámaras)
    631,    # IPP (impresoras)
    1900,   # SSDP
    3389,   # RDP (Windows)
    5000,   # UPnP / NAS / Flask
    5353,   # mDNS
    62078,  # iPhone sync (lockdownd)
    7000,   # AirPlay (Apple TV)
    8008,   # Chromecast HTTP
    8009,   # Chromecast Cast
    8080,   # HTTP alt
    8443,   # HTTPS alt
    9100,   # JetDirect (impresoras)
    32400,  # Plex
)

# Puertos -> (device_type_hint, os_hint)
PORT_HINTS: dict[int, tuple[str | None, str | None]] = {
    445:    ("computer", "Windows"),
    3389:   ("computer", "Windows"),
    548:    ("computer", "macOS"),
    62078:  ("phone",    "iOS"),
    7000:   ("tv",       "Apple TV / AirPlay"),
    8008:   ("chromecast", "Google Cast"),
    8009:   ("chromecast", "Google Cast"),
    9100:   ("printer",  None),
    631:    ("printer",  None),
    554:    ("camera",   None),
    32400:  ("media_server", None),
    22:     ("server",   None),
}

# mDNS service type -> (device_type_hint, os_hint)
MDNS_DEVICE_HINTS: dict[str, tuple[str | None, str | None]] = {
    "_googlecast":          ("chromecast",  "Google Cast"),
    "_airplay":             ("tv",          "Apple"),
    "_raop":                ("speaker",     "Apple"),
    "_apple-mobdev2":       ("phone",       "iOS"),
    "_companion-link":      ("phone",       "iOS/macOS"),
    "_ipp":                 ("printer",     None),
    "_ipps":                ("printer",     None),
    "_pdl-datastream":      ("printer",     None),
    "_scanner":             ("scanner",     None),
    "_spotify-connect":     ("speaker",     None),
    "_sonos":               ("speaker",     "Sonos"),
    "_samsungtv":           ("tv",          "Samsung"),
    "_androidtvremote2":    ("tv",          "Android TV"),
    "_homekit":             ("smart_home",  "Apple HomeKit"),
    "_hap":                 ("smart_home",  "HomeKit"),
    "_workstation":         ("computer",    None),
    "_smb":                 ("computer",    "Windows/macOS"),
    "_afpovertcp":          ("computer",    "macOS"),
    "_rfb":                 ("computer",    None),
    "_ssh":                 ("server",      None),
}

# NetBIOS suffix -> (device_type_hint, os_hint)
NETBIOS_SUFFIX_HINTS: dict[int, tuple[str | None, str | None]] = {
    0x00: ("computer", "Windows"),
    0x03: ("computer", "Windows"),
    0x20: ("server",   "Windows"),
    0x1C: ("domain_controller", "Windows"),
    0x1D: ("domain_controller", "Windows"),
    0x1E: ("domain_controller", "Windows"),
}

# SSDP keyword -> (device_type_hint, os_hint)
SSDP_KEYWORD_HINTS: list[tuple[re.Pattern, str | None, str | None]] = [
    (re.compile(r"roku", re.I),                     "tv",          "Roku"),
    (re.compile(r"chromecast|googlecast", re.I),    "chromecast",  "Google Cast"),
    (re.compile(r"sonos", re.I),                    "speaker",     "Sonos"),
    (re.compile(r"xbox", re.I),                     "console",     "Xbox"),
    (re.compile(r"playstation|ps4|ps5", re.I),      "console",     "PlayStation"),
    (re.compile(r"nintendo", re.I),                 "console",     "Nintendo"),
    (re.compile(r"printer|ipp", re.I),              "printer",     None),
    (re.compile(r"router|gateway|internetgateway", re.I), "router", "Router"),
    (re.compile(r"mediarenderer", re.I),            "media_player", None),
    (re.compile(r"philips.*hue|hue bridge", re.I),  "smart_home",  "Philips Hue"),
    (re.compile(r"sonoff|tasmota|esphome", re.I),   "iot",         None),
]


# ---------------------------------------------------------------------------
# Fingerprint: estructura común
# ---------------------------------------------------------------------------

@dataclass
class FingerprintResult:
    ip: str
    names: list[str] = field(default_factory=list)
    services: list[str] = field(default_factory=list)
    open_ports: list[int] = field(default_factory=list)
    model: str | None = None
    device_type_hint: str | None = None
    os_hint: str | None = None
    evidence: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def merge(self, other: "FingerprintResult") -> None:
        for n in other.names:
            if n and n not in self.names:
                self.names.append(n)
        for s in other.services:
            if s and s not in self.services:
                self.services.append(s)
        for p in other.open_ports:
            if p not in self.open_ports:
                self.open_ports.append(p)
        if other.model and not self.model:
            self.model = other.model
        if other.device_type_hint and not self.device_type_hint:
            self.device_type_hint = other.device_type_hint
        if other.os_hint and not self.os_hint:
            self.os_hint = other.os_hint
        self.evidence.extend(other.evidence)
        self.errors.extend(other.errors)

    def to_host_fields(self) -> dict:
        return {
            "names": list(self.names),
            "services": list(self.services),
            "open_ports": sorted(self.open_ports),
            "model": self.model,
            "device_type": self.device_type_hint,
            "os_hint": self.os_hint,
            "evidence": list(self.evidence),
            "fingerprint_errors": list(self.errors),
        }


# ---------------------------------------------------------------------------
# Probe 1: mDNS (multicast, se hace UNA vez por escaneo)
# ---------------------------------------------------------------------------

class MdnsProbe:
    """
    Escucha mDNS durante `timeout` segundos y devuelve un dict
    {ip: FingerprintResult} con lo que cada host anunció.
    """

    def __init__(self, timeout: float = 6.0):   # ← Cambio 1: 2.0 → 6.0 por defecto
        self.timeout = timeout
    def probe_network(self) -> dict[str, FingerprintResult]:
        results: dict[str, FingerprintResult] = {}
        if not _HAS_ZEROCONF:
            print("[MdnsProbe] zeroconf no disponible")
            return results

        try:
            zc = Zeroconf()
            print("[MdnsProbe] Zeroconf iniciado")
        except Exception as e:
            print(f"[MdnsProbe] Zeroconf() falló: {type(e).__name__}: {e}")
            return results

        found: list[tuple[str, str]] = []

        class _Listener:
            def add_service(self, zc_, type_, name):
                found.append((type_, name))

            def update_service(self, zc_, type_, name):
                found.append((type_, name))

            def remove_service(self, zc_, type_, name):
                pass

        browsers = []
        try:
            listener = _Listener()
            service_types = [
                "_services._dns-sd._udp.local.",
                "_googlecast._tcp.local.",
                "_airplay._tcp.local.",
                "_raop._tcp.local.",
                "_ipp._tcp.local.",
                "_ipps._tcp.local.",
                "_printer._tcp.local.",
                "_pdl-datastream._tcp.local.",
                "_smb._tcp.local.",
                "_afpovertcp._tcp.local.",
                "_workstation._tcp.local.",
                "_companion-link._tcp.local.",
                "_apple-mobdev2._tcp.local.",
                "_homekit._tcp.local.",
                "_hap._tcp.local.",
                "_spotify-connect._tcp.local.",
                "_sonos._tcp.local.",
                "_samsungtv._tcp.local.",
                "_androidtvremote2._tcp.local.",
            ]
            for t in service_types:
                browsers.append(ServiceBrowser(zc, t, listener))

            end = time.monotonic() + self.timeout
            while time.monotonic() < end:
                time.sleep(0.1)

            print(f"[MdnsProbe] servicios encontrados: {len(found)}")

            for type_, name in found:
                try:
                    info = zc.get_service_info(type_, name, timeout=800)
                except Exception:
                    info = None
                if info is None:
                    continue

                addrs = info.parsed_addresses()
                if not addrs:
                    continue

                clean_name = name.split(".")[0]
                service_key = type_.split(".")[0]

                # ← Cambio 3A: log por servicio
                print(f"[MdnsProbe] tipo={service_key} nombre={clean_name!r} addrs={addrs}")

                for addr in addrs:
                    # ← Cambio 3B: log por host
                    print(f"[MdnsProbe]   -> host {addr}")

                    if ":" in addr:
                        continue
                    r = results.setdefault(addr, FingerprintResult(ip=addr))

                    if clean_name and clean_name not in r.names:
                        r.names.append(clean_name)
                        r.evidence.append({
                            "source": "mdns", "kind": "name",
                            "value": clean_name, "confidence": 0.9,
                        })

                    if service_key in MDNS_DEVICE_HINTS:
                        dev, os_hint = MDNS_DEVICE_HINTS[service_key]
                        if dev and not r.device_type_hint:
                            r.device_type_hint = dev
                        if os_hint and not r.os_hint:
                            r.os_hint = os_hint
                        if service_key not in r.services:
                            r.services.append(service_key)
                        r.evidence.append({
                            "source": "mdns", "kind": "service",
                            "value": service_key, "confidence": 0.7,
                        })

                    for k, v in (info.properties or {}).items():
                        if not v:
                            continue
                        key = k.decode(errors="ignore") if isinstance(k, bytes) else str(k)
                        val = v.decode(errors="ignore") if isinstance(v, bytes) else str(v)
                        if key.lower() in ("model", "md", "ty") and not r.model:
                            r.model = val
                            r.evidence.append({
                                "source": "mdns", "kind": "model",
                                "value": val, "confidence": 0.6,
                            })

        except Exception as e:
            print(f"[MdnsProbe] error: {type(e).__name__}: {e}")
        finally:
            try:
                zc.close()
            except Exception:
                pass

        print(f"[MdnsProbe] hosts identificados: {list(results.keys())}")
        return results


# ---------------------------------------------------------------------------
# Probe 2: NetBIOS (NBSTAT UDP/137)
# ---------------------------------------------------------------------------

def _encode_netbios_name(name: str) -> bytes:
    name = (name.upper() + " " * 16)[:16]
    out = bytearray()
    for ch in name:
        c = ord(ch)
        out.append(0x41 + (c >> 4))
        out.append(0x41 + (c & 0x0F))
    return bytes(out)


class NetbiosProbe:
    def __init__(self, timeout: float = 0.7):
        self.timeout = timeout

    def probe(self, ip: str) -> FingerprintResult:
        result = FingerprintResult(ip=ip)

        header = struct.pack("!HHHHHH", 0x1337, 0x0000, 1, 0, 0, 0)
        question = _encode_netbios_name("*") + struct.pack("!HH", 0x0021, 0x0001)
        packet = header + question

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(self.timeout)
        try:
            sock.sendto(packet, (ip, 137))
            data, _ = sock.recvfrom(2048)
        except (socket.timeout, OSError):
            return result
        finally:
            sock.close()

        try:
            self._parse(data, result)
        except Exception as e:
            result.errors.append(f"netbios: {type(e).__name__}: {e}")
        return result

    def _parse(self, data: bytes, result: FingerprintResult) -> None:
        offset = 12 + 34
        if len(data) < offset + 1:
            return
        num_names = data[offset]
        offset += 1

        for _ in range(num_names):
            if len(data) < offset + 18:
                break
            raw_name = data[offset:offset + 15]
            suffix = data[offset + 15]
            flags = struct.unpack("!H", data[offset + 16:offset + 18])[0]
            offset += 18

            is_group = bool(flags & 0x8000)
            name = raw_name.decode("ascii", errors="ignore").strip()

            if not is_group and name and name not in result.names:
                result.names.append(name)
                result.evidence.append({
                    "source": "netbios", "kind": "name",
                    "value": name, "confidence": 0.9,
                })

            if suffix in NETBIOS_SUFFIX_HINTS:
                dev, os_hint = NETBIOS_SUFFIX_HINTS[suffix]
                if dev and not result.device_type_hint:
                    result.device_type_hint = dev
                if os_hint and not result.os_hint:
                    result.os_hint = os_hint
                result.evidence.append({
                    "source": "netbios", "kind": "service",
                    "value": f"suffix_0x{suffix:02X}", "confidence": 0.8,
                })


# ---------------------------------------------------------------------------
# Probe 3: SSDP (UDP/1900)
# ---------------------------------------------------------------------------

class SsdpProbe:

    SSDP_ADDR = ("239.255.255.250", 1900)
    M_SEARCH = (
        "M-SEARCH * HTTP/1.1\r\n"
        "HOST: 239.255.255.250:1900\r\n"
        'MAN: "ssdp:discover"\r\n'
        "MX: 1\r\n"
        "ST: ssdp:all\r\n"
        "\r\n"
    ).encode()

    def __init__(self, timeout: float = 2.0):
        self.timeout = timeout

    def probe_network(self) -> dict[str, FingerprintResult]:
        """SSDP también es multicast: descubre todos y agrupa por IP."""
        results: dict[str, FingerprintResult] = {}
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        if hasattr(socket, "SO_REUSEPORT"):
            try:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
            except OSError:
                pass

        try:
            sock.bind(("", 1900))
            print("[SsdpProbe] bind OK en 1900")
        except OSError as e:
            print(f"[SsdpProbe] bind 1900 falló: {e} (seguimos igual)")

        sock.settimeout(1.0)

        for i in range(3):
            try:
                sock.sendto(self.M_SEARCH, self.SSDP_ADDR)
                print(f"[SsdpProbe] M-SEARCH #{i+1} enviado")
            except OSError as e:
                print(f"[SsdpProbe] sendto falló: {e}")
                break

        end = time.monotonic() + self.timeout

        while time.monotonic() < end:
            try:
                data, addr = sock.recvfrom(65507)
            except socket.timeout:
                continue
            except OSError:
                break

            ip = addr[0]
            text = data.decode("utf-8", errors="ignore")
            r = results.setdefault(ip, FingerprintResult(ip=ip))
            print(f"[SsdpProbe] respuesta de {ip}")

            for line in text.splitlines():
                low = line.lower()
                if low.startswith("server:") or low.startswith("st:") or low.startswith("usn:"):
                    value = line.split(":", 1)[1].strip()
                    if value and value not in r.services:
                        r.services.append(value)
                    for pattern, dev, os_hint in SSDP_KEYWORD_HINTS:
                        if pattern.search(value):
                            if dev and not r.device_type_hint:
                                r.device_type_hint = dev
                            if os_hint and not r.os_hint:
                                r.os_hint = os_hint
                            r.evidence.append({
                                "source": "ssdp", "kind": "service",
                                "value": value, "confidence": 0.6,
                            })
                            break

        sock.close()
        print(f"[SsdpProbe] hosts detectados: {list(results.keys())}")
        return results
   


# ---------------------------------------------------------------------------
# Probe 4: sondeo rápido de puertos TCP
# ---------------------------------------------------------------------------

class PortProbe:
    def __init__(self, ports: tuple[int, ...] = COMMON_PORTS,
                 timeout: float = 0.35, workers: int = 40):
        self.ports = ports
        self.timeout = timeout
        self.workers = workers

    def probe(self, ip: str) -> FingerprintResult:

        result = FingerprintResult(ip=ip)
        open_ports: list[int] = []

        import concurrent.futures
        from collections import Counter

        def _check(port: int) -> int | None:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(self.timeout)
            try:
                if s.connect_ex((ip, port)) == 0:
                    return port
            except OSError:
                return None
            finally:
                s.close()
            return None

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.workers) as ex:
                for port in ex.map(_check, self.ports):
                    if port is not None:
                        open_ports.append(port)
        except Exception as e:
            result.errors.append(f"ports: {type(e).__name__}: {e}")

        result.open_ports = sorted(open_ports)

        for port in result.open_ports:
            result.services.append(f"tcp/{port}")

        hint_votes: Counter[tuple[str | None, str | None]] = Counter()

        for port in result.open_ports:
            if port in PORT_HINTS:
                dev, os_hint = PORT_HINTS[port]
                hint_votes[(dev, os_hint)] += 1
                result.evidence.append({
                    "source": "ports", "kind": "service",
                    "value": f"tcp/{port}", "confidence": 0.5,
                })

        if hint_votes:
            best_dev, best_os = hint_votes.most_common(1)[0][0]
            if best_dev and not result.device_type_hint:
                result.device_type_hint = best_dev
            if best_os and not result.os_hint:
                result.os_hint = best_os

        return result
   


# ---------------------------------------------------------------------------
# Scanner principal
# ---------------------------------------------------------------------------

class NmapScanner:

    def __init__(self):
        self.nmap_path = shutil.which("nmap")

        self.mac_lookup = MacLookup()
        try:
            self.mac_lookup.update_vendors()
        except Exception as e:
            print(f"[NmapScanner] No se pudo actualizar la base de "
                  f"fabricantes MAC: {type(e).__name__}: {e}")

        self._own_ip = self._detect_own_ip()

        self._mdns_probe = MdnsProbe(timeout=6.0)
        self._ssdp_probe = SsdpProbe(timeout=6.0)
        self._netbios_probe = NetbiosProbe(timeout=2.0)
        self._port_probe = PortProbe()

    # ------------------------------------------------------------------ scan

    def scan_hosts(
        self,
        target: str | None = None,
        timeout: int = DEFAULT_SCAN_TIMEOUT_SECONDS,
    ) -> ScanResult:
        if self.nmap_path is None:
            raise NmapNotFoundError(
                "Nmap no está instalado o no se encuentra en el PATH."
            )

        if target is None:
            target = self._detect_local_cidr()

        self._validate_target(target)

        command = [
            self.nmap_path,
            "-sn",
            "-PR",
            "-n",
            "-T4",
            "--max-retries", "2",
            "--host-timeout", "10s",
            "-oX", "-",
            target,
        ]

        start = time.perf_counter()

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as e:
            #[CALIDAD] ISO /IEC 25010 · Fiabilidad | IEEE 730 · Manejo controlado de errores
            raise ScanTimeoutError(
                f"El escaneo de '{target}' superó el tiempo límite de "
                f"{timeout}s."
            ) from e
        except subprocess.CalledProcessError as e:
            detail = (e.stderr or "").strip() or str(e)
            raise ScanFailedError(
                f"Nmap terminó con error al escanear '{target}': {detail}"
            ) from e

        try:
            hosts = self._parse_hosts(result.stdout)
        except ET.ParseError as e:
            raise ScanFailedError(
                f"No se pudo interpretar la salida de Nmap: {e}"
            ) from e

        # --- Fingerprinting ---
        mdns_map = self._safe_map(self._mdns_probe.probe_network)
        ssdp_map = self._safe_map(self._ssdp_probe.probe_network)

        for host in hosts:
            fp = FingerprintResult(ip=host.ip)
            fp.merge(mdns_map.get(host.ip, FingerprintResult(host.ip)))
            fp.merge(ssdp_map.get(host.ip, FingerprintResult(host.ip)))
            fp.merge(self._safe_probe(self._netbios_probe, host.ip))
            fp.merge(self._safe_probe(self._port_probe, host.ip))
            self._apply_fingerprint(host, fp)

        elapsed = time.perf_counter() - start

        return ScanResult(
            target=target,
            hosts=hosts,
            total_hosts=len(hosts),
            duration_seconds=round(elapsed, 2),
            scanned_at=datetime.now(timezone.utc).isoformat(),
        )

    # -------------------------------------------------------------- helpers

    @staticmethod
    def _safe_map(fn) -> dict[str, FingerprintResult]:
        try:
            return fn() or {}
        except Exception:
            return {}

    @staticmethod
    def _safe_probe(probe, ip: str) -> FingerprintResult:
        try:
            return probe.probe(ip)
        except Exception as e:
            r = FingerprintResult(ip=ip)
            r.errors.append(f"{type(probe).__name__}: {type(e).__name__}: {e}")
            return r

    @staticmethod
    def _apply_fingerprint(host: Host, fp: FingerprintResult) -> None:
        if fp.names:
            for n in fp.names:
                if n and n not in host.names:
                    host.names.append(n)
            best = fp.names[0]
            for n in fp.names:
                if n and not n.replace(".", "").isdigit():
                    best = n
                    break
            if best:
                host.hostname = best

        host.services = list(fp.services)
        host.open_ports = list(fp.open_ports)
        host.model = fp.model
        host.device_type = fp.device_type_hint
        host.os_hint = fp.os_hint
        host.evidence = list(fp.evidence)
        host.fingerprint_errors = list(fp.errors)

    # ---------------------------------------------------------- existing code

    def _validate_target(self, target: str) -> None:
        #[CALIDAD] ISO/IEC 25010 · Fiabilidad y seguridad: Valida la entrada antes de ejecutar Nmap para evitar errores y posibles vulnerabilidades.
        try:
            ipaddress.ip_network(target, strict=False)
        except ValueError as e:
            raise InvalidTargetError(
                f"'{target}' no es una dirección IP o red CIDR válida."
            ) from e

    def _detect_local_cidr(self) -> str:
        if self._own_ip is None:
            raise ScanFailedError(
                "No se pudo determinar la IP local para detectar la red "
                "a escanear."
            )

        for iface, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if addr.family == socket.AF_INET and addr.address == self._own_ip:
                    network = ipaddress.IPv4Network(
                        f"{self._own_ip}/{addr.netmask}", strict=False
                    )
                    return str(network)

        raise ScanFailedError(
            "No se pudo determinar la máscara de red de la interfaz local."
        )

    def _is_locally_administered(self, mac: str) -> bool:
        try:
            first_octet = int(mac.split(":")[0], 16)
            return bool(first_octet & 0b00000010)
        except (ValueError, IndexError):
            return False

    def _get_vendor(self, mac: str) -> str:
        if self._is_locally_administered(mac):
            return "No disponible (MAC privada/aleatoria)"
        try:
            result = self.mac_lookup.lookup(mac)
            # En versiones recientes, lookup() devuelve una corrutina.
            # No podemos await-ear aquí (estamos en sync), así que
            # corremos el event loop hasta completarla.
            if hasattr(result, "__await__"):
                import asyncio
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        # Estamos dentro de un event loop (FastAPI);
                        # no podemos usar run_until_complete.
                        return "Desconocido"
                    return loop.run_until_complete(result)
                except RuntimeError:
                    return "Desconocido"
            return result
        except VendorNotFoundError:
            return "Desconocido"
        except Exception:
            return "Desconocido"

    def _detect_own_ip(self) -> str | None:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except OSError:
            return None
        finally:
            s.close()

    def _get_own_mac(self) -> str | None:
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

            if mac is None:
                mac = self._resolve_mac(ip)

            if mac and not vendor:
                vendor = self._get_vendor(mac)

            hostname_element = host.find("./hostnames/hostname")
            hostname = None
            if hostname_element is not None:
                hostname = hostname_element.get("name")

            if hostname is None:
                hostname = self._get_hostname(ip)

            hosts.append(
                Host(
                    ip=ip,
                    hostname=hostname,
                    mac=mac,
                    vendor=vendor,
                    status="up",
                )
            )

        return hosts