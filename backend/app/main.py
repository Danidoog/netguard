from dataclasses import asdict

from fastapi import FastAPI

from app.scanners.nmap_scanner import NmapScanner
from app.services.scan_service import ScanService


app = FastAPI(
    title="NetGuard API",
    version="0.1.0"
)

scanner = NmapScanner()
scan_service = ScanService(scanner)


@app.get("/")
def root():
    return {
        "application": "NetGuard",
        "status": "online"
    }


@app.post("/api/scans")
def scan_network():
    hosts = scan_service.scan_network()

    return {
        "hosts": [asdict(host) for host in hosts]
    }