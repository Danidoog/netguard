# **PROYECTO “NETGUARD”**
## **SISTEMA AUTOMATIZADO DE DESCUBRIMIENTO Y MONITOREO DE REDES LOCALES**

# **PLAN DE PRUEBAS LIGHT**

**Preparado por:** Equipo de Desarrollo y QA NetGuard (Daniel Alexander Cobo Arboleda & Juan Esteban Colorado Coral)  
**Fecha:** 12 de Noviembre de 2026  
**Versión:** 1.0  
**Basado en:** [TestPlanTemplate.md](file:///home/danidoog/proyectos/netguard/contex/TestPlanTemplate.md) y Especificaciones Técnicas ([contex/](file:///home/danidoog/proyectos/netguard/contex))

---

1. # **Introducción**

   **NetGuard** es una solución integral de software para la detección, inventario y análisis de seguridad en redes locales privadas y autorizadas. Permite a los administradores de red y usuarios descubrir automáticamente los equipos conectados mediante escaneos de red activos (utilizando Nmap CLI y enriquecimiento heurístico OUI/mDNS), identificar servicios y puertos críticos expuestos (como 21 FTP, 22 SSH, 23 Telnet, 445 SMB, 3389 RDP), auditar la persistencia temporal de los equipos (`first_seen`, `last_seen`, `is_present`) y clasificar dispositivos confiables frente a posibles intrusos o equipos no reconocidos.

---

2. # **Alcance de las pruebas (¿Qué se va a probar?)**

   Se probarán las historias de usuario y requerimientos más críticos del backlog del proyecto, abarcando el flujo completo de descubrimiento, visualización, persistencia, auditoría y resiliencia:

| Ticket / ID | Nombre de la Historia / Requisito | Descripción y Criterio de Aceptación Clave |
| :--- | :--- | :--- |
| **H01 / RF01** | **Iniciar escaneo de red** | Disparar escaneo de la subred local (detección automática de CIDR o personalizado). Validar ejecución asíncrona mediante `/api/tasks/scans` y visualización del progreso en tiempo real con `ScanProgressOverlay` sin congelar la interfaz. |
| **H02 / RF02** | **Consultar dispositivos detectados** | Visualizar la lista de hosts detectados en el último escaneo con sus atributos: IP, MAC, hostname, fabricante (OUI), estado (*up*) y lista de puertos abiertos. |
| **H03 / RF03** | **Consultar historial de escaneos** | Consultar en la vista `/history` los escaneos previos persistidos en SQLite (`scans` y `hosts`), organizados cronológicamente con fecha, duración y total de dispositivos descubiertos. |
| **H05 / RF04** | **Consultar inventario persistente de dispositivos** | Visualizar en la vista `/devices` la totalidad de dispositivos únicos registrados en la base de datos (`devices`), distinguiendo su estado de presencia (`is_present`), primera conexión y última conexión. |
| **H06 / RF05** | **Asignar alias y estado de confianza (*trusted*)** | Modificar el alias personalizado y marcar un dispositivo como confiable (*trusted = true/false*) mediante el modal `DeviceDetailModal` y el endpoint `PATCH /api/devices/{mac}`. |
| **H07 / RF06** | **Visualizar analíticas y puertos sensibles** | Verificar en la vista `/analytics` el cálculo de salud de red (*Network Health*), tendencias de conexión (gráficas Recharts) y alertas sobre puertos de alto riesgo detectados (21, 22, 23, 445, 3389). |
| **H08 / RF07** | **Manejo y notificación de errores de escaneo** | Validar que ante fallos previstos (`INVALID_TARGET`, `NMAP_NOT_FOUND`, `SCAN_TIMEOUT`, `SCAN_ALREADY_RUNNING`) el backend retorne códigos HTTP y mensajes estructurados (ISO/IEC 25010 e IEEE 730) y el frontend los muestre mediante Toast/Banners sin crashear. |
| **H09 / RF08** | **Validar conexión antes del escaneo** | Comprobar que el sistema detecte la ausencia de interfaz de red activa antes de iniciar el escaneo y alerte oportunamente al usuario (`useNetworkStatus` y `psutil`). |
| **H10 / RF09** | **Detección y clasificación de nuevos dispositivos** | Comprobar que equipos cuya MAC no esté en la base de datos se etiqueten automáticamente como nuevos (`is_new: first_seen == last_seen`) y aparezcan como tarjeta prioritaria de revisión (`ReviewCard`) en el Dashboard. |
| **RNF01** | **Usabilidad y Modo Claro/Oscuro** | Verificar interfaz responsiva, cambio de tema (Dark/Light), navegación fluida mediante el `Sidebar` y componentes con diseño accesible. |
| **RNF02** | **Fiabilidad y Recuperación de Datos** | Comprobar transacciones SQLite con `rollback` automático en errores de inserción y detección de tareas interrumpidas por reinicio de servidor (`SERVER_RESTARTED`). |
| **RNF05** | **Sistema de Ayuda y Glosario** | Validar acceso a la vista `/ayuda` y despliegue de tooltips informativos (`helpTerms.ts`) para conceptos técnicos de red complejos. |

---

3. # **Fuera del Alcance**

   1. **Pruebas de explotación ofensiva y penetración profunda (Pentesting ofensivo):** NetGuard no realiza explotación activa ni inyección de exploits en los hosts detectados.
   2. **Escaneo de redes externas (WAN) o dominios de Internet:** El alcance está restringido a subredes LAN privadas y autorizadas (RFC 1918).
   3. **Pruebas de estrés y saturación de ancho de banda masivo (DDoS):** No se evaluará el envío masivo de paquetes que degrade la red local doméstica o sature el router/gateway.
   4. **Instalación como aplicación móvil nativa:** La suite opera como cliente web SPA para navegadores de escritorio y emulación responsive.

---

4. # **Tipos de la prueba / estrategia (¿Cómo ejecutar las pruebas?)**

   1. **Pruebas Unitarias y de Integración Automatizadas:**
      * Ejecución de suite Pytest en backend (`pytest -v backend/tests/`).
      * Pruebas de orquestación de tareas en segundo plano (`test_scan_tasks.py`).
      * Pruebas de lógica de sincronización y modelos de persistencia (`test_scan_service.py`).
      * Pruebas de excepciones y respuestas HTTP normalizadas (`test_error_handling.py`).
   2. **Pruebas Funcionales Basadas en Historias de Usuario (Exploratorias & Guiadas):**
      * Ejecución del ciclo completo de escaneo desde el Dashboard, revisión de tarjetas `ReviewCard`, edición de dispositivos en `/devices` y validación en `/analytics`.
   3. **Pruebas de Contrato de API (REST API Testing):**
      * Verificación de endpoints con Swagger UI (`/docs`), Postman o curl: validación de códigos de estado HTTP (200, 202, 400, 404, 409, 500, 504) y payloads JSON.
   4. **Pruebas de Resiliencia y Manejo de Errores (Error & Edge Cases):**
      * Simular ausencia de la herramienta Nmap en el sistema (`NMAP_NOT_FOUND`).
      * Disparar un escaneo con un escaneo ya en curso (`409 Conflict - SCAN_ALREADY_RUNNING`).
      * Desconectar la interfaz de red física y verificar que no se permitan peticiones inválidas.
      * Reiniciar el backend durante una tarea en estado `running` y validar que se marque con error `SERVER_RESTARTED`.
   5. **Cross-Browser Testing:**
      * Navegación y renderizado en navegadores modernos: Google Chrome, Mozilla Firefox y Microsoft Edge.
   6. **Pruebas de Aceptación de Usuario (UAT):**
      * Verificación visual de usabilidad con usuarios no especializados para evaluar la claridad de los datos, glosario y métricas de seguridad.

---

5. # **Ambiente de prueba**

   * **Backend API:** `http://127.0.0.1:8000` (Python 3.12+, FastAPI, Uvicorn, SQLAlchemy).
   * **Base de Datos:** SQLite local en `backend/app/db/netguard.db` (y base de datos en memoria SQLite `:memory:` para pruebas automatizadas Pytest).
   * **Frontend Client:** `http://localhost:5173` (React 19, TypeScript, Vite 8, Tailwind CSS v4).
   * **Herramienta del Sistema Operativo:** Binario `nmap` instalado localmente en Linux / macOS / Windows (`nmap --version >= 7.80`).
   * **Red de Pruebas:** Red local privada (ej. `192.168.1.0/24` o `192.168.0.0/24`) con router doméstico, al menos 2 hosts activos (PC, smartphone) y un dispositivo con servicios abiertos (ej. servidor web local en puerto 80/443 o SSH en puerto 22).

---

6. # **Datos de prueba**

   * **Rangos de red válidos para escaneo:** `192.168.1.0/24`, `192.168.0.0/24`, `127.0.0.1/32`.
   * **Rangos de red inválidos (casos negativos):** `999.999.999.999/24`, `red_invalida`, `192.168.1.500`, entradas vacías `""`.
   * **Dispositivos simulados / Fixtures de Nmap XML:** Payloads de salida XML preconfigurados en `backend/tests/conftest.py` con hosts conteniendo MACs conocidas, puertos sensibles (22, 23, 445, 3389) y dispositivos sin hostname.
   * **Payloads para actualización de dispositivo (`PATCH /api/devices/{mac}`):**
     ```json
     {
       "alias": "Laptop Trabajo QA",
       "trusted": true
     }
     ```

---

7. # **Riesgos**

| Riesgo | Probabilidad | Impacto | Mitigación |
| :--- | :---: | :---: | :--- |
| **Nmap CLI no instalado o sin permisos de ejecución en el sistema anfitrión** | Media | Alto | El backend valida la existencia del binario antes de ejecutar el escaneo; retorna excepción controlada `NmapNotFoundError` (`500`) con instrucciones claras en UI. |
| **Escaneo bloqueado o resultados incompletos por aislamiento de red (AP Isolation / Firewalls)** | Media | Medio | Realizar las pruebas en una red Wi-Fi configurada sin aislamiento de clientes, o conectar equipos de prueba por interfaz cableada Ethernet. |
| **Concurrencia o bloqueo de archivo en base de datos SQLite por múltiples accesos simultáneos** | Baja | Medio | Configuración de SQLAlchemy con `check_same_thread: False`, sesiones por petición (`get_db`) y control de tareas únicas concurrentes (`SCAN_ALREADY_RUNNING`). |
| **Tiempo de respuesta excesivo en redes con rangos muy amplios (/16 o subredes congestionadas)** | Media | Medio | Arquitectura asíncrona no bloqueante con `FastAPI BackgroundTasks` (`202 Accepted`), temporizador de timeout de 120s (`ScanTimeoutError`) y restricciones de CIDR recomendadas a `/24`. |
| **Dispositivos modernos con aleatorización de MAC (Private MAC en Android/iOS)** | Alta | Bajo | Explicar en el sistema de ayuda/glosario el efecto de las MACs dinámicas y registrar el cambio de IP o reaparición en el historial de eventos del sistema. |
