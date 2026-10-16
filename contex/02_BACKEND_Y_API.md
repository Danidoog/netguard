# 02 - Backend y Especificación de la API

## 1. Estructura de Directorios del Backend

```
backend/
├── app/
│   ├── core/
│   │   ├── database.py       # Engine SQLAlchemy y sesión SessionLocal (SQLite)
│   │   └── exceptions.py     # Jerarquía de excepciones (NetGuardError, ScanAlreadyRunningError, etc.)
│   ├── db/
│   │   ├── models.py         # Modelos ORM (ScanRecord, HostRecord, DeviceRecord, ScanTaskRecord)
│   │   └── netguard.db       # Archivo de base de datos SQLite persistente
│   ├── models/
│   │   ├── host.py           # Dataclass del Host detectado
│   │   └── scan_result.py    # Dataclass del resultado general del escaneo
│   ├── scanners/
│   │   └── nmap_scanner.py   # Wrapper de Nmap, detección de subred y fingerprinting
│   ├── services/
│   │   ├── scan_service.py   # Lógica de negocio, orquestación y sincronización en BD
│   │   └── task_service.py   # Orquestación de tareas en segundo plano y concurrencia
│   ├── worker.py             # Worker CLI independiente para procesamiento fuera del API
│   └── main.py               # Instancia de FastAPI, handlers de error y rutas HTTP
├── scripts/
│   └── manual_scan.py        # Script CLI para probar el scanner directamente
├── tests/
│   ├── conftest.py           # Fixtures de Pytest (BD en memoria / mocks)
│   ├── test_error_handling.py# Pruebas de manejo de errores HTTP y excepciones
│   ├── test_scan_service.py  # Pruebas unitarias de ScanService
│   └── test_scan_tasks.py    # Pruebas completas del módulo de tareas en segundo plano
├── probe_test.py             # Script de pruebas puntuales
└── requirements.txt          # Dependencias de Python
```

---

## 2. Endpoints de la API REST (`main.py`)

Todos los endpoints están prefijados bajo `/api` (o raíz `/` para comprobación de estado).

### `GET /`
- Comprobación básica de salud (*health check*).
- **Respuesta:**
  ```json
  {
    "application": "NetGuard",
    "status": "online"
  }
  ```

### `POST /api/tasks/scans` (Aliases: `/api/scans/async`, `/api/tasks`) [Status 202 Accepted]
- Inicia un escaneo de red en segundo plano sin bloquear la petición HTTP.
- **Body opcional:**
  ```json
  {
    "target": "192.168.1.0/24"
  }
  ```
- **Flujo:** Valida la red objetivo, verifica que no exista otro escaneo activo (rechazando con `409 Conflict` si ya hay uno), registra la tarea en SQLite con estado `pending`, la despacha al ejecutor en segundo plano y retorna de inmediato.
- **Respuesta (202 Accepted):**
  ```json
  {
    "id": "c1f71df9-4df8-48b8-b118-2cbe84920b70",
    "target": "192.168.1.0/24",
    "status": "pending",
    "created_at": "2026-10-14T21:00:00Z",
    "started_at": null,
    "finished_at": null,
    "scan_id": null,
    "result": null,
    "error": null
  }
  ```

### `GET /api/tasks/{task_id}` (Alias: `/api/scans/tasks/{task_id}`)
- Consulta el estado de una tarea por su identificador.
- Estados posibles: `pending`, `running`, `completed`, `failed`.
- Si `completed`: incluye `finished_at`, `scan_id` y el resumen de `result`.
- Si `failed`: incluye `finished_at` y el objeto `error` (`{"code": "...", "message": "..."}`).
- Si el servidor se reinició mientras la tarea estaba `running`: el servidor la marca automáticamente como `failed` con código `SERVER_RESTARTED`.

### `GET /api/tasks`
- Lista las tareas registradas ordenadas cronológicamente por `created_at DESC`.
- Soporta filtros opcionales por query param: `?status=completed&limit=50&offset=0`.

### `POST /api/scans` (Síncrono legacy)
- Dispara un nuevo escaneo síncrono de la red local. Mantiene compatibilidad total.
- Protegido contra colisiones: si ya hay una tarea en segundo plano en curso, retorna `409 Conflict` (`SCAN_ALREADY_RUNNING`).
- **Respuesta:**
  ```json
  {
    "target": "192.168.1.0/24",
    "total_hosts": 5,
    "duration_seconds": 12.45,
    "scanned_at": "2026-10-14 20:15:00",
    "hosts": [...]
  }
  ```

### `GET /api/scans`
- Retorna el listado histórico de escaneos ordenados de más reciente a más antiguo (`id DESC`).
- Cada escaneo incluye su lista de hosts asociados embebida.

### `GET /api/scans/{scan_id}`
- Obtiene los metadatos de un escaneo específico por su ID.
- Retorna `404 Not Found` si no existe.

### `GET /api/scans/{scan_id}/hosts`
- Retorna la lista detallada de los hosts detectados en dicho escaneo.

### `GET /api/devices`
- Retorna el inventario consolidado de todos los dispositivos descubiertos, ordenados por `last_seen DESC`.
- Incluye el campo calculado `is_new: first_seen == last_seen`.

### `PATCH /api/devices/{mac}`
- Actualiza los datos editables por el usuario para un dispositivo:
  - `alias`: `string | null` (ej. "Laptop de Trabajo")
  - `trusted`: `boolean | null` (marcar si es confiable o no)
- **Body:**
  ```json
  {
    "alias": "Mi Teléfono Personal",
    "trusted": true
  }
  ```

---

## 3. Motor de Escaneo y Fingerprinting (`nmap_scanner.py`)

1. **Detección Automática de Red**:
   - Analiza las interfaces del sistema con `psutil.net_if_addrs()` e identifica la IP local activa y su máscara de red para calcular el CIDR de destino (ej. `192.168.1.0/24`).
2. **Ejecución de Nmap**:
   - Lanza `nmap` mediante `subprocess.run` solicitando salida en XML (`-oX -`).
   - Escanea una lista de puertos predeterminada (`COMMON_PORTS`: 22, 53, 80, 443, 445, 548, 554, 631, 1900, 3389, 5000, 5353, 62078, 7000, 8008, 8009, 8080, 8443, 9100, 32400).
   - Manejo de timeout global con `DEFAULT_SCAN_TIMEOUT_SECONDS = 120`.
3. **Resolución de Fabricante (OUI)**:
   - Consulta `MacLookup` a partir de la dirección MAC del host.
4. **Heurística de Fingerprinting**:
   - Identifica dispositivos como Apple TV, Chromecast, servidores Plex, impresoras JetDirect, cámaras IP (RTSP puerto 554), routers, etc., correlacionando puertos abiertos, nombres mDNS y banners.

---

## 4. Jerarquía de Excepciones (`exceptions.py`)

- `NetGuardError`: Excepción base con atributos `code` y `http_status`.
  - `InvalidTargetError` (HTTP 400, `INVALID_TARGET`)
  - `NmapNotFoundError` (HTTP 500, `NMAP_NOT_FOUND`)
  - `ScanTimeoutError` (HTTP 504, `SCAN_TIMEOUT`)
  - `ScanFailedError` (HTTP 500, `SCAN_FAILED`)
- Toda respuesta de error tiene el formato estándar:
  ```json
  {
    "error": {
      "code": "SCAN_TIMEOUT",
      "message": "El proceso de Nmap superó el tiempo límite..."
    }
  }
  ```
