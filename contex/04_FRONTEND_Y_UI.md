# 04 - Frontend y Arquitectura de la Interfaz

## 1. Stack Tecnológico del Frontend

* **Framework:** React 19 (`react`, `react-dom`).
* **Lenguaje:** TypeScript.
* **Empaquetador y Dev Server:** Vite 8.
* **Estilos:** Tailwind CSS v4 con `@tailwindcss/vite` y `@tailwindcss/postcss`.
* **Gráficas y Analíticas:** Recharts 3.
* **Iconografía:** Lucide React (`lucide-react`).

---

## 2. Estructura de Directorios (`frontend/src/`)

```
frontend/src/
├── api/
│   ├── cache.ts               # Caché en memoria con invalidación de claves
│   ├── devices.ts             # Cliente HTTP para /api/devices
│   ├── scans.ts               # Cliente HTTP para /api/scans
│   └── scheduler.ts           # Cliente HTTP para configuración y tareas de fondo
├── assets/                    # Imágenes y logos (hero.png, svgs)
├── components/
│   ├── CollapsibleDay.tsx     # Agrupador por fechas colapsable en historial
│   ├── ConfirmDialog.tsx      # Diálogo modal de confirmación
│   ├── DeviceDetailModal.tsx  # Modal de detalles y edición de dispositivo
│   ├── DeviceTable.tsx / DevicesTable.tsx # Tablas de inventario
│   ├── GlossaryInfo.tsx       # Tooltip explicativo de términos técnicos
│   ├── ReviewCard.tsx         # Tarjeta de acción para dispositivos no confiables
│   ├── ScanDetailModal.tsx    # Modal con hosts de un escaneo histórico
│   ├── ScanProgressOverlay.tsx# Animación/pantalla de escaneo en curso
│   ├── Sidebar.tsx            # Menú de navegación lateral
│   ├── StatCard.tsx           # Métricas clave tipo tarjeta
│   ├── StatusBanner.tsx       # Alertas de estado de red / desconexión de backend
│   ├── ThemeToggle.tsx        # Selector de tema (Dark / Light / System)
│   ├── Toast.tsx              # Notificaciones emergentes
│   └── Tooltip.tsx            # Tooltips accesibles
├── constants/
│   └── helpTerms.ts           # Glosario y explicaciones de conceptos de red
├── errors/
│   ├── ErrorBoundary.tsx      # Límite de captura de errores de React
│   └── apiErrors.ts           # Clases de error (NetworkError, ParseError, ApiError)
├── hooks/
│   ├── useBackendStatus.ts    # Sondeo y verificación de salud del backend
│   ├── useCopyToClipboard.ts  # Utilidad para copiar IPs/MACs al portapapeles
│   └── useNetworkStatus.ts    # Detección de conectividad del navegador (online/offline)
├── pages/
│   ├── Analytics.tsx          # Métricas visuales, gráficos Recharts y puertos sensibles
│   ├── Dashboard.tsx          # Panel principal, lanzamiento de escaneos y alertas
│   ├── Devices.tsx            # Gestión completa de inventario de dispositivos
│   ├── Help.tsx               # Centro de ayuda y glosario interactivo
│   ├── History.tsx            # Historial cronológico de escaneos anteriores
│   └── Settings.tsx           # Panel de configuración del sistema y escaneos de fondo
├── types/
│   ├── device.types.ts        # Tipado TypeScript para Device y DeviceUpdate
│   ├── history.types.ts       # Tipado de eventos históricos
│   └── scan.types.ts          # Tipado de ScanResult, Host, ScanHistoryItem
├── utils/
│   ├── deviceHelpers.ts       # Lógica de salud de red, etiquetas y limpieza de hostnames
│   ├── deviceIcon.ts          # Asignación de icono según tipo de dispositivo
│   ├── deviceStats.ts         # Agregación de estadísticas de dispositivos
│   ├── exportHistory.ts       # Exportación de historial
│   ├── format.ts              # Formateo de fechas relativas y tiempos
│   └── scanEvents.ts          # Detección de eventos entre escaneos sucesivos
├── App.tsx                    # Orquestador de vistas, tema y estado global
├── index.css                  # Estilos globales y tokens Tailwind
└── main.tsx                   # Punto de entrada de la aplicación
```

---

## 3. Vistas Principales

### 1. Dashboard (`Dashboard.tsx`)
- **Lanzamiento de Escaneo:** Botón principal para iniciar `createScan()`. Muestra la superposición `ScanProgressOverlay` durante los ~10-60 segundos que tarda Nmap.
- **Salud de la Red (*Network Health*):** Cálculo porcentual basado en dispositivos no identificados o puertos riesgosos.
- **Tarjetas de Revisión (*ReviewCard*):** Destaca dispositivos nuevos o no confiables para que el usuario los revise y clasifique rápidamente como confiables o sospechosos.
- **Dispositivos Recientes:** Muestra la lista de hosts detectados en el último escaneo realizado.

### 2. Inventario de Dispositivos (`Devices.tsx`)
- Tabla completa de todos los dispositivos registrados en la base de datos.
- Búsqueda en tiempo real por IP, MAC, fabricante o alias.
- Filtros por estado: *Todos*, *Conectados ahora*, *De confianza*, *Sospechosos/No confiables*, *Nuevos*.
- Edición mediante modal (`DeviceDetailModal`): permite cambiar el alias y marcar como confiable (*trusted*).

### 3. Historial de Escaneos (`History.tsx`)
- Agrupación por días (`CollapsibleDay.tsx`) con horas exactas y duración del escaneo.
- Resumen de hosts encontrados y diferencias.
- Apertura de modal con el desglose completo de puertos y servicios de cualquier escaneo pasado.

### 4. Analíticas y Seguridad (`Analytics.tsx`)
- **Tendencia de Presencia:** Gráfico de líneas (`LineChart` de Recharts) con la evolución de dispositivos activos en el tiempo.
- **Distribución de Fabricantes:** Estadísticas de marcas detectadas (Apple, Intel, Samsung, Espressif, etc.).
- **Puertos y Servicios Sensibles:** Alertas y recuento de puertos críticos expuestos en la red (puertos 21 FTP, 22 SSH, 23 Telnet, 445 SMB, 3389 RDP).
- **Dispositivos Inestables:** Identificación de equipos que cambian frecuentemente de IP o sufren desconexiones constantes.

### 5. Configuración del Sistema (`Settings.tsx`)
- **Escaneos de Fondo (Segundo Plano):** Botón principal para activar/desactivar el planificador periódico de escaneos y switch accesible.
- **Disparo Manual Asíncrono:** Botón para ejecutar un escaneo en segundo plano de inmediato sin esperar al temporizador (`POST /api/tasks/scans`).
- **Monitoreo en Tiempo Real:** Estado del motor (activo/en espera), sondeo del progreso de escaneos activos (`pending` / `running`) con indicador animado y cálculo de próximo escaneo.
- **Parámetros del Planificador:** Ajuste de frecuencia (15m, 30m, 1h, 4h, 12h, 24h) y red CIDR objetivo personalizada o autodetección.

### 6. Ayuda y Glosario (`Help.tsx`)
- Respuestas a preguntas frecuentes sobre el funcionamiento de NetGuard.
- Diccionario de términos: MAC, IP, CIDR, Puertos, OUI, DHCP, Fingerprinting, etc.

---

## 4. Gestión de Estado, Caché y Conectividad

- **Caché en Memoria (`api/cache.ts`):** Reduce peticiones innecesarias. Cuando se crea un nuevo escaneo o se actualiza un dispositivo, se invalidan automáticamente las claves `scan-history:` y `devices`.
- **Detección de Caídas:**
  - `useNetworkStatus`: Detecta si el navegador pierde acceso a la red física.
  - `useBackendStatus`: Monitorea el endpoint raíz (`GET /`) y muestra un banner en la parte superior si el servidor FastAPI no responde.
- **Temas:** Soporta modo Oscuro, Claro y Automático (según preferencias del sistema operativo), persistido en `localStorage` bajo `netguard-theme`.
