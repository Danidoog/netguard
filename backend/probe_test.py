from app.scanners.nmap_scanner import MdnsProbe

probe = MdnsProbe(timeout=6.0)
resultados = probe.probe_network()

for ip, fp in resultados.items():
    print(ip, "->", fp.names, fp.services, fp.model, fp.device_type_hint)