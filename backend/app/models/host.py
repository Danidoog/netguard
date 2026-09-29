from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Host:
    # --- Campos originales (sin cambios) ---
    ip: str
    hostname: str | None = None
    mac: str | None = None
    vendor: str | None = None
    status: str = "up"

    # --- Fingerprinting (todos opcionales, no rompen código existente) ---

    # Nombres descubiertos por mDNS / NetBIOS (además de hostname DNS).
    names: list[str] = field(default_factory=list)

    # Servicios anunciados (tipos mDNS como "_googlecast._tcp.local.",
    # strings SSDP como "urn:dial-multiscreen-org:service:dial:1", etc.)
    services: list[str] = field(default_factory=list)

    # Puertos TCP abiertos detectados por el sondeo rápido.
    open_ports: list[int] = field(default_factory=list)

    # Modelo del dispositivo (a veces anunciado por mDNS TXT records).
    model: str | None = None

    # Tipo inferido: "phone", "tv", "printer", "chromecast", "router",
    # "computer", "console", "speaker", "camera", "server", "iot", etc.
    device_type: str | None = None

    # Sistema operativo inferido: "iOS", "Windows", "macOS", "Android TV"...
    os_hint: str | None = None

    # Evidencia cruda: lista de dicts con {source, kind, value, confidence}.
    # Se guarda para poder auditar cómo se llegó a la conclusión.
    evidence: list[dict] = field(default_factory=list)

    # Errores no fatales ocurridos durante el fingerprinting (p.ej. si
    # zeroconf no estaba instalado, si NetBIOS agotó timeout, etc.).
    fingerprint_errors: list[str] = field(default_factory=list)

    # --------------------------------------------------------------- helpers

    @property
    def best_name(self) -> str | None:
        """
        Devuelve el nombre más descriptivo disponible, en este orden:
        1. El primer nombre no-numérico de `names` (típicamente mDNS/NetBIOS).
        2. El hostname resuelto por DNS inverso.
        3. El primer nombre de `names` aunque sea numérico.
        4. None.
        """
        for n in self.names:
            if n and not n.replace(".", "").isdigit():
                return n
        if self.hostname:
            return self.hostname
        if self.names:
            return self.names[0]
        return None

    @property
    def display_name(self) -> str:
        """
        Nombre "humano" para mostrar en UI/logs, con fallbacks sensatos:
        mejor nombre > vendor > MAC > IP. Nunca devuelve None ni vacío.
        """
        name = self.best_name
        if name:
            return name
        if self.vendor and not self.vendor.startswith("No disponible"):
            return f"{self.vendor} ({self.ip})"
        if self.mac:
            return f"{self.ip} [{self.mac}]"
        return self.ip