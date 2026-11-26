# 01 - Visión General y Arquitectura del Sistema

## 1. Propósito de NetGuard
NetGuard es una solución de monitoreo de red e inventario de ciberseguridad diseñada para redes locales privadas y autorizadas. Su objetivo es proporcionar visibilidad completa de los equipos conectados, alertar sobre intrusiones o dispositivos no autorizados y evaluar la superficie de ataque mediante el análisis de puertos y servicios abiertos.

### Casos de Uso Clave
- **Inventario Automatizado**: Descubrimiento dinámico de hosts en la subred local mediante ARP/Nmap y mDNS/Bonjour.
- **Detección de Intrusos / Equipos Nuevos**: Clasificación de dispositivos en "Conocidos / Confiables" (*trusted*) y "Nuevos / No confiables" (*untrusted*).
- **Análisis de Vulnerabilidad y Puertos Sensibles**: Identificación de servicios inseguros o críticos expuestos (FTP 21, Telnet 23, SSH 22, SMB 445, RDP 3389).
- **Auditoría Temporal**: Seguimiento de cuándo un dispositivo se conectó por primera vez (`first_seen`), su última conexión (`last_seen`) y si actualmente está activo (`is_present`).

---

## 2. Diagrama de Arquitectura

```mermaid
graph TD
    subgraph Frontend ["Frontend (React 19 + TypeScript + Vite)"]
        UI_Dash["Dashboard (/)]"]
        UI_Dev["Devices (/devices)"]
        UI_Hist["History (/history)"]
        UI_Anl["Analytics (/analytics)"]
        UI_Help["Help (/ayuda)"]
        API_Client["API Layer (fetch + cache en memoria)"]
        UI_Dash --> API_Client
        UI_Dev --> API_Client
        UI_Hist --> API_Client
        UI_Anl --> API_Client
    end

    subgraph Backend ["Backend (FastAPI + Python)"]
        FastAPI_App["FastAPI Routes (main.py)"]
        ScanService["ScanService (scan_service.py)"]
        NmapScanner["NmapScanner (nmap_scanner.py)"]
        Fingerprint["Motor de Heurísticas & OUI"]
        DB_Engine["SQLAlchemy ORM"]
        
        FastAPI_App --> ScanService
        ScanService --> NmapScanner
        NmapScanner --> Fingerprint
        ScanService --> DB_Engine
    end

    subgraph HostOS ["Sistema Operativo & Red Local"]
        NmapCLI["Nmap Binary CLI"]
        Subnet["Subred Local (ARP / ICMP / TCP probes)"]
        ZeroConf["mDNS / Zeroconf / SSDP"]
        NmapScanner --> NmapCLI
        NmapCLI --> Subnet
        Fingerprint --> ZeroConf
    end

    subgraph Storage ["Almacenamiento Local"]
        SQLiteDB[("SQLite: netguard.db")]
        DB_Engine --> SQLiteDB
    end

    API_Client -- "HTTP JSON /api/*" --> FastAPI_App
```

---

## 3. Normas de Calidad y Estándares Aplicados

En el código fuente se aplican explícitamente principios de:
- **ISO/IEC 25010** (Calidad de Producto de Software):
  - *Fiabilidad (Reliability)*: Transacciones con `rollback` automático en base de datos; manejo uniforme de excepciones a través de `NetGuardError`.
  - *Seguridad (Security)*: Manejo de errores no controlados sin filtrar detalles internos o trazas de pila al cliente HTTP.
  - *Eficiencia de Desempeño (Performance Efficiency)*: Tiempo límite de escaneo configurable (`DEFAULT_SCAN_TIMEOUT_SECONDS = 120`), registro estandarizado de métricas de duración por escaneo (**ISO/IEC 25023**).
- **IEEE 730**: Manejo de errores consistente y respuestas estructuradas con códigos claros (`INVALID_TARGET`, `NMAP_NOT_FOUND`, `SCAN_TIMEOUT`, `SCAN_FAILED`, `INTERNAL_ERROR`).
