from dataclasses import dataclass


@dataclass
class Host:
    ip: str
    hostname: str | None = None
    mac: str | None = None
    vendor: str | None = None
    status: str = "up"