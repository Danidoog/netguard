# 05 - Guía de Ejecución, Comandos y Pruebas

## 1. Requisitos Previos del Sistema

- **Python:** 3.12 o superior.
- **Node.js:** 18 o superior (recomendado 20+).
- **Nmap CLI:** Debe estar instalado y accesible en el `PATH` del sistema:
  ```bash
  # En Fedora / RHEL
  sudo dnf install nmap

  # En Ubuntu / Debian
  sudo apt update && sudo apt install nmap

  # En Arch Linux
  sudo pacman -S nmap
  ```

---

## 2. Puesta en Marcha del Backend

### Paso 1: Activar el entorno virtual de Python
Desde la raíz del proyecto (`netguard/`):
```bash
source .venv/bin/activate
```

*(Si no existe o necesita reinstalar dependencias):*
```bash
pip install -r backend/requirements.txt
```

### Paso 2: Iniciar el servidor FastAPI
Desde la carpeta `backend/`:
```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
* O alternativamente desde la raíz con `PYTHONPATH`:
```bash
PYTHONPATH=backend uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

El servidor estará disponible en:
- API Base: `http://127.0.0.1:8000`
- Documentación interactiva Swagger: `http://127.0.0.1:8000/docs`
- Documentación ReDoc: `http://127.0.0.1:8000/redoc`

### Paso 3 (Opcional): Worker CLI independiente
El servidor FastAPI ya incluye un ejecutor en segundo plano integrado. No obstante, si se desea procesar tareas en un proceso de sistema independiente:
```bash
# Desde la carpeta backend/
python -m app.worker
# o directamente:
python app/worker.py
```

---

## 3. Puesta en Marcha del Frontend

### Paso 1: Instalar dependencias
Desde la carpeta `frontend/`:
```bash
cd frontend
npm install
```

### Paso 2: Ejecutar el servidor de desarrollo Vite
```bash
npm run dev
```

El frontend iniciará en `http://localhost:5173`.
*Vite está configurado en [`vite.config.ts`](file:///home/danidoog/proyectos/netguard/frontend/vite.config.ts) para redirigir automáticamente cualquier llamada a `/api` hacia `http://127.0.0.1:8000`.*

### Otros scripts del Frontend:
```bash
npm run build    # Compila TypeScript y genera el bundle de producción
npm run lint     # Ejecuta ESLint
npm run preview  # Previsualiza la build de producción localmente
```

---

## 4. Ejecución de Pruebas y Scripts de Utilidad

### Ejecutar Tests con Pytest:
Desde la raíz del proyecto:
```bash
source .venv/bin/activate
pytest backend/tests -v
```

### Script de Escaneo Manual por Consola:
Permite probar la detección de Nmap y fingerprinting directamente en la terminal sin levantar la API ni el frontend:
```bash
source .venv/bin/activate
python backend/scripts/manual_scan.py
```

---

## 5. Resolución de Problemas Frecuentes (*Troubleshooting*)

| Problema / Error | Causa Posible | Solución |
| :--- | :--- | :--- |
| `SCAN_ALREADY_RUNNING` (HTTP 409) | Se solicitó un nuevo escaneo mientras otro aún está en estado `pending` o `running`. | Esperar a que la tarea activa termine antes de iniciar un nuevo escaneo, o consultar su estado en `GET /api/tasks/{task_id}`. |
| `SERVER_RESTARTED` | El servidor FastAPI se reinició o cayó mientras una tarea estaba ejecutándose. | La tarea queda marcada limpiamente como fallida. Se puede solicitar una nueva tarea en `POST /api/tasks/scans`. |
| `NMAP_NOT_FOUND` | El binario de `nmap` no está instalado en el sistema operativo o no está en el `PATH`. | Instalar nmap con el gestor de paquetes de tu distribución Linux (`dnf`, `apt`, `pacman`). |
| `SCAN_TIMEOUT` | La red es muy grande o hay dispositivos que demoran en responder a los probes. | El límite por defecto es de 120s en `DEFAULT_SCAN_TIMEOUT_SECONDS` dentro de `nmap_scanner.py`. |
| `StatusBanner: Servidor Desconectado` | El backend de FastAPI no se está ejecutando en el puerto 8000. | Iniciar `uvicorn` en `http://127.0.0.1:8000`. |
| `database is locked` | Múltiples procesos intentan escribir en SQLite simultáneamente. | SQLite maneja un bloqueo a nivel archivo; verificar que no haya scripts manuales bloqueando la sesión. |

