# NetGuard - Documentación de Contexto del Proyecto

> Esta carpeta contiene el contexto técnico y funcional completo de **NetGuard**, estructurado para consulta rápida de agentes y desarrolladores sin necesidad de reexplorar todo el repositorio.

---

## 📌 Índice de Documentos de Contexto

1. **[01_ARQUITECTURA_Y_VISION.md](file:///home/danidoog/proyectos/netguard/contex/01_ARQUITECTURA_Y_VISION.md)**: Visión global, propósito, casos de uso, diagrama general y normas de calidad (ISO/IEC 25010).
2. **[02_BACKEND_Y_API.md](file:///home/danidoog/proyectos/netguard/contex/02_BACKEND_Y_API.md)**: FastAPI, motor de escaneo Nmap, fingerprinting, endpoints REST, excepciones y pruebas con Pytest.
3. **[03_BASE_DE_DATOS.md](file:///home/danidoog/proyectos/netguard/contex/03_BASE_DE_DATOS.md)**: Modelos SQLAlchemy (`ScanRecord`, `HostRecord`, `DeviceRecord`), ciclo de vida de dispositivos y persistencia SQLite.
4. **[04_FRONTEND_Y_UI.md](file:///home/danidoog/proyectos/netguard/contex/04_FRONTEND_Y_UI.md)**: React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, vistas (Dashboard, Devices, History, Analytics, Help), caché y hooks.
5. **[05_GUIA_EJECUCION_Y_COMANDOS.md](file:///home/danidoog/proyectos/netguard/contex/05_GUIA_EJECUCION_Y_COMANDOS.md)**: Cómo iniciar backend y frontend, ejecutar tests, scripts de prueba manual y troubleshooting.

---

## 🚀 Resumen Ultrarrápido del Proyecto

* **Nombre:** NetGuard
* **Propósito:** Detección, monitoreo, auditoría y análisis de seguridad para dispositivos y servicios en redes locales autorizadas.
* **Stack Principal:**
  * **Backend:** Python 3.12+, FastAPI, SQLAlchemy, SQLite, Nmap CLI, zeroconf, mac-vendor-lookup.
  * **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, Lucide React.
* **Base de Datos:** SQLite local en `backend/app/db/netguard.db`.
* **Diferenciador Clave:** No solo detecta IPs, sino que realiza fingerprinting (identificación de tipo de dispositivo, fabricante por OUI, OS y puertos sensibles como 21, 22, 23, 445, 3389) y gestiona dispositivos de confianza (*trusted*) vs no confiables.
