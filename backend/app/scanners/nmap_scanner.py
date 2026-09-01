import shutil
import subprocess
import xml.etree.ElementTree as ET

from app.models.host import Host


class NmapScanner:

    def __init__(self):
        self.nmap_path = shutil.which("nmap")

        if self.nmap_path is None:
            raise RuntimeError(
                "Nmap no está instalado o no se encuentra en el PATH."
            )

    def scan_hosts(self, target: str) -> list[Host]:
        command = [
         self.nmap_path,
         "-sn",
         "-n",
         "-T4",
         "--max-retries", "1",
         "--host-timeout", "5s",
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

            hostname_element = host.find("./hostnames/hostname")

            hostname = None

            if hostname_element is not None:
                hostname = hostname_element.get("name")
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