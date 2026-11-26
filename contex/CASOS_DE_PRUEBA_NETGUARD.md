# **SUITE Y CASOS DE PRUEBA: NETGUARD**
## **SISTEMA AUTOMATIZADO DE DESCUBRIMIENTO Y MONITOREO DE REDES LOCALES**

> **Documento asociado:** [CasosDePrueba_NetGuard.xlsx](file:///home/danidoog/proyectos/netguard/contex/CasosDePrueba_NetGuard.xlsx)  
> **Plan de Pruebas Base:** [PLAN_DE_PRUEBAS_NETGUARD.md](file:///home/danidoog/proyectos/netguard/contex/PLAN_DE_PRUEBAS_NETGUARD.md)  
> **Plantilla de referencia:** [TestCaseTemplate.xlsx](file:///home/danidoog/proyectos/netguard/contex/TestCaseTemplate.xlsx)  
> **Fecha:** 12 de Noviembre de 2026 | **Versión:** 1.0  
> **Preparado por:** Equipo de Desarrollo y QA NetGuard (*Daniel Alexander Cobo Arboleda & Juan Esteban Colorado Coral*)

---

## 📌 PARTE 1: HISTORIAS DE USUARIO Y CRITERIOS DE ACEPTACIÓN

---

### **HISTORIA 1: INICIAR ESCANEO DE RED (DESCUBRIMIENTO ACTIVO)**
* **ID:** `RF01` / `H01`
* **Como:** Administrador de red o usuario doméstico
* **Quiero:** Iniciar un escaneo activo de la subred local (detección automática de CIDR o ingreso manual)
* **Para:** Descubrir todos los dispositivos conectados a la red local y evaluar la superficie de ataque inicial.
* **Criterios de Aceptación:**
  1. Detectar automáticamente la interfaz y máscara CIDR activa (ej. `192.168.1.0/24`).
  2. Despachar la tarea de forma asíncrona mediante `POST /api/tasks/scans` retornando HTTP `202 Accepted` con `task_id`.
  3. Mostrar el componente interactivo `ScanProgressOverlay` con temporizador y estado de progreso en tiempo real.
  4. Rechazar peticiones concurrentes con HTTP `409 Conflict` (código `SCAN_ALREADY_RUNNING`) si ya existe un escaneo activo.
  5. Respetar el tiempo límite de ejecución configurado (timeout global de 120 segundos).

---

### **HISTORIA 2: CONSULTAR DISPOSITIVOS DETECTADOS EN EL ESCANEO**
* **ID:** `RF02` / `H02`
* **Como:** Administrador de red
* **Quiero:** Visualizar en el Dashboard la lista enriquecida de hosts descubiertos
* **Para:** Conocer la dirección IP, MAC, nombre del equipo, fabricante OUI y puertos abiertos de cada dispositivo.
* **Criterios de Aceptación:**
  1. La tabla de resultados debe renderizar automáticamente los hosts al completarse la tarea de escaneo.
  2. Identificar el fabricante de cada equipo mediante resolución OUI a partir de la MAC (`MacLookup`).
  3. Mostrar hostname limpio detectado por DNS inverso o nombres mDNS/Bonjour.
  4. Clasificar el tipo de dispositivo (router, servidor, laptop, móvil, IoT) según heurísticas de puertos.
  5. Permitir abrir el modal de detalles (`DeviceDetailModal`) al interactuar con cualquier host.

---

### **HISTORIA 3: HISTORIAL Y COMPARACIÓN CRONOLÓGICA DE ESCANEOS**
* **ID:** `RF03` / `H03`
* **Como:** Administrador de red
* **Quiero:** Consultar y filtrar el registro histórico de todos los escaneos ejecutados
* **Para:** Auditar la evolución temporal de la red, comparar hosts presentes y verificar resultados de auditorías previas.
* **Criterios de Aceptación:**
  1. La vista `/history` debe consultar `GET /api/scans` ordenando cronológicamente de más reciente a más antiguo.
  2. Agrupar los escaneos por fecha con paneles colapsables (`CollapsibleDay`).
  3. Cada ítem debe presentar: hora de escaneo, total de dispositivos encontrados y duración en segundos.
  4. Permitir la apertura del modal `ScanDetailModal` para inspeccionar los hosts y puertos de cualquier escaneo histórico.

---

### **HISTORIA 4: INVENTARIO CONSOLIDADO Y CONTROL DE PRESENCIA**
* **ID:** `RF04` / `H05`
* **Como:** Administrador de red
* **Quiero:** Disponer de un inventario unificado de todos los dispositivos registrados en la red
* **Para:** Rastrear cuándo se conectaron por primera vez (`first_seen`), cuándo se vieron por última vez (`last_seen`) y si están activos (`is_present`).
* **Criterios de Aceptación:**
  1. La vista `/devices` debe consultar `GET /api/devices` con registros consolidados por dirección MAC.
  2. Disponer de filtros rápidos: *Todos*, *Conectados ahora* (`is_present`), *Confiables* (`trusted`), *Sospechosos* y *Nuevos*.
  3. Ofrecer un buscador reactivo que filtre por IP, MAC, alias o fabricante en tiempo real.
  4. Mostrar fechas relativas legibles (ej. "hace 5 minutos", "ayer").

---

### **HISTORIA 5: ASIGNACIÓN DE ALIAS Y GESTIÓN DE DISPOSITIVOS DE CONFIANZA**
* **ID:** `RF05` / `H06`
* **Como:** Administrador de red
* **Quiero:** Asignar un alias reconocible y clasificar equipos como Confiables (*trusted*) o No Confiables
* **Para:** Distinguir fácilmente los dispositivos propios y autorizados de posibles intrusos o equipos no reconocidos.
* **Criterios de Aceptación:**
  1. Permitir editar el alias del equipo y el interruptor de confianza en el `DeviceDetailModal`.
  2. Persistir los cambios en la base de datos a través de `PATCH /api/devices/{mac}`.
  3. Actualizar la caché del frontend e invalidar registros desactualizados sin requerir recargar la página.
  4. Destacar dispositivos no confiables o nuevos en el Dashboard mediante tarjetas `ReviewCard`.

---

### **HISTORIA 6: ANALÍTICAS DE SEGURIDAD Y DETECCIÓN DE PUERTOS CRÍTICOS**
* **ID:** `RF06` / `H07`
* **Como:** Administrador de red
* **Quiero:** Visualizar gráficos de tendencia de conexión y alertas sobre puertos y servicios inseguros
* **Para:** Detectar vulnerabilidades en la red local y mitigar vectores de ataque antes de que sean explotados.
* **Criterios de Aceptación:**
  1. La vista `/analytics` debe calcular y mostrar el porcentaje de Salud de la Red (*Network Health*).
  2. Renderizar gráfico interactivo con Recharts de la evolución de dispositivos activos a lo largo del tiempo.
  3. Listar y alertar sobre la detección de puertos críticos específicos: 21 FTP, 22 SSH, 23 Telnet, 445 SMB, 3389 RDP.
  4. Identificar dispositivos inestables o que presenten cambios frecuentes de dirección IP.

---

### **HISTORIA 7: CONTROL ROBUSTO Y NOTIFICACIÓN DE ERRORES DE ESCANEO**
* **ID:** `RF07` / `H08`
* **Como:** Administrador de red
* **Quiero:** Recibir información clara, estructurada y accionable ante cualquier eventualidad o fallo durante el escaneo
* **Para:** Comprender el origen del error y aplicar la solución adecuada sin experimentar bloqueos en la interfaz.
* **Criterios de Aceptación:**
  1. Si el binario Nmap no está instalado, responder con HTTP 500 (`NMAP_NOT_FOUND`) y mostrar mensaje explicativo.
  2. Si se introduce un CIDR inválido, responder con HTTP 400 (`INVALID_TARGET`) sin lanzar excepciones no controladas.
  3. Si el escaneo supera 120s, retornar HTTP 504 (`SCAN_TIMEOUT`) y liberar los recursos en segundo plano.
  4. Cumplir con la norma ISO/IEC 25010 e IEEE 730 ocultando stacktraces internos y mostrando alertas amigables al usuario.

---

### **HISTORIA 8: VERIFICACIÓN DE CONECTIVIDAD PREVIA Y ALERTA DE NUEVOS EQUIPOS**
* **ID:** `RF08` / `H09` & `H10`
* **Como:** Administrador de red
* **Quiero:** Que el sistema verifique si hay conexión antes de escanear y alerte inmediatamente cuando detecte nuevos equipos
* **Para:** Prevenir escaneos inútiles en modo desconectado e intervenir tempranamente ante dispositivos desconocidos.
* **Criterios de Aceptación:**
  1. Validar las interfaces del equipo con `psutil` en backend y `useNetworkStatus` en frontend antes de disparar peticiones.
  2. Deshabilitar el botón de escaneo y mostrar aviso preventivo si el host está offline o desconectado de la LAN.
  3. Etiquetar automáticamente como "Nuevo" (`is_new = true`) a todo host cuya MAC no existiera previamente en la base de datos.
  4. Desplegar notificación Toast y `ReviewCard` en el Dashboard al concluir el escaneo si hay equipos nuevos.

---

## 📌 PARTE 2: SUITE DE PRUEBAS DE EJECUCIÓN (TEST CASES)

### **ÁREA FUNCIONAL 1: Escaneo de Red y Tareas Asíncronas (RF01)**

| No | Caso de Prueba | Prioridad | Precondiciones | Datos de Entrada | Pasos | Resultado Esperado | Resultado Obtenido | Estado |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1.0** | Ejecutar escaneo automático de la subred local (Happy Path) | **Alta** | Servidor FastAPI en ejecución; host conectado a red LAN; Nmap CLI en PATH. | Opción "Escanear red local" (detecta CIDR ej. `192.168.1.0/24`) | 1. Abrir `http://localhost:5173`<br>2. Clic en "Escanear Red"<br>3. Observar overlay de progreso<br>4. Esperar finalización | Se despacha tarea asíncrona (202 Accepted); overlay muestra avance y luego se presentan los hosts descubiertos. | La tarea se despachó con código 202; tras ~18s el escaneo finalizó y los hosts se cargaron en el Dashboard. | **OK** |
| **2.0** | Ejecutar escaneo con rango CIDR personalizado válido | **Media** | Servidor online; permisos de red activos. | Target manual: `192.168.1.0/24` o `127.0.0.1/32` | 1. Enviar POST a `/api/tasks/scans` con body `{"target": "192.168.1.0/24"}`<br>2. Consultar `GET /api/tasks/{task_id}` | Respuesta HTTP 202 con ID de tarea; estado transiciona de `pending` a `running` y luego a `completed`. | Tarea procesada satisfactoriamente con resultado exitoso y total de hosts registrado en SQLite. | **OK** |
| **3.0** | Intentar lanzar escaneo concurrente mientras hay uno activo (Caso Negativo) | **Alta** | Tarea de escaneo en ejecución activa (`running`). | Clic repetido en "Escanear Red" o POST a `/api/tasks/scans` | 1. Iniciar un escaneo de red<br>2. Inmediatamente intentar disparar un segundo escaneo | El sistema rechaza la solicitud con código HTTP 409 Conflict y mensaje estructurado `SCAN_ALREADY_RUNNING`. | Se retornó HTTP 409 con código de error `SCAN_ALREADY_RUNNING` y la tarea en curso no fue interrumpida. | **OK** |
| **4.0** | Ingresar un rango de red con sintaxis CIDR inválida (Caso Negativo) | **Alta** | Servidor backend online. | Target inválido: `999.999.999.999/24` o `mi_red_domestica` | 1. Enviar POST a `/api/tasks/scans` con target no numérico o fuera de rango IP<br>2. Verificar respuesta | El sistema valida la entrada y rechaza con HTTP 400 Bad Request y código `INVALID_TARGET`. | El backend rechazó la petición con HTTP 400 y mensaje "Dirección de red no válida". | **OK** |
| **5.0** | Validar control de timeout en escaneo prolongado (>120s) | **Media** | Subred configurada con retardo extremo o simulación de timeout. | Target con múltiples saltos o simulación de timeout en Nmap | 1. Disparar escaneo que supere `DEFAULT_SCAN_TIMEOUT_SECONDS` (120s)<br>2. Verificar estado de la tarea | La tarea se cancela de forma segura, marcándose como `failed` con código `SCAN_TIMEOUT` (HTTP 504). | El scanner abortó el proceso hijo al alcanzar los 120s y liberó la base de datos sin bloqueos. | **OK** |

---

### **ÁREA FUNCIONAL 2: Descubrimiento y Detalle de Dispositivos (RF02)**

| No | Caso de Prueba | Prioridad | Precondiciones | Datos de Entrada | Pasos | Resultado Esperado | Resultado Obtenido | Estado |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1.0** | Visualizar dispositivos detectados en tabla del Dashboard (Happy Path) | **Alta** | Escaneo previo completado con al menos 2 hosts activos en la red. | Hosts descubiertos en el último escaneo | 1. Finalizar escaneo en Dashboard<br>2. Revisar la tabla de dispositivos recientes | Se visualizan todos los hosts con IP, MAC, hostname, fabricante y badge de estado (up). | Todos los hosts del escaneo se visualizaron correctamente con formato ordenado y badge de presencia. | **OK** |
| **2.0** | Resolución y visualización del fabricante por dirección MAC (OUI) | **Media** | Dispositivos reales con MACs de marcas conocidas (Apple, Intel, Samsung, Espressif). | Dirección MAC con prefijo OUI estándar | 1. Localizar dispositivo en la tabla de hosts<br>2. Inspeccionar la columna "Fabricante" | Muestra el nombre comercial de la marca (ej. "Apple, Inc.", "Intel Corporate") o "Desconocido" si no aplica. | Fabricantes identificados correctamente según la base OUI de MacLookup. | **OK** |
| **3.0** | Manejo de dispositivos sin nombre de host DNS/mDNS | **Baja** | Dispositivo en red local que no responde a consultas de nombre inverso. | Host con IP activa pero sin hostname | 1. Realizar escaneo de la subred<br>2. Verificar registro del host sin nombre | La interfaz debe mostrar la IP como identificador fallback y no cadenas "null" o indefinidas. | La UI mostró limpiamente la dirección IP como nombre por defecto sin errores de renderizado. | **OK** |
| **4.0** | Abrir modal de detalles y consultar puertos abiertos de un host | **Alta** | Al menos un host con servicios abiertos (ej. HTTP 80, SSH 22). | Clic en fila o botón de detalles del host | 1. Hacer clic sobre el dispositivo en la tabla<br>2. Revisar contenido de `DeviceDetailModal` | Se abre el modal mostrando los puertos abiertos, nombres de servicios, dirección MAC y tipo inferido. | Modal se desplegó con los puertos y servicios formateados correctamente. | **OK** |

---

### **ÁREA FUNCIONAL 3: Historial Cronológico de Escaneos (RF03)**

| No | Caso de Prueba | Prioridad | Precondiciones | Datos de Entrada | Pasos | Resultado Esperado | Resultado Obtenido | Estado |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1.0** | Consultar listado histórico de escaneos anteriores (Happy Path) | **Alta** | Al menos dos escaneos ejecutados previamente y guardados en SQLite. | Navegación a ruta `/history` | 1. Clic en "Historial" en el Sidebar<br>2. Observar registros listados | Se muestra la lista cronológica descendente de escaneos con fecha, hora, duración y total de hosts. | Los escaneos se cargaron ordenados de más reciente a más antiguo desde SQLite. | **OK** |
| **2.0** | Colapsar y expandir agrupación por días (CollapsibleDay) | **Media** | Escaneos realizados en diferentes fechas en el historial. | Clic en cabecera de fecha de `CollapsibleDay` | 1. Ir a `/history`<br>2. Clic en encabezado de un día agrupado para colapsar y volver a expandir | El acordeón se oculta y despliega fluidamente sin perder el estado de la página. | La animación de colapso y expansión funcionó correctamente. | **OK** |
| **3.0** | Inspeccionar detalle de un escaneo pasado (ScanDetailModal) | **Media** | Historial de escaneos disponible. | Clic en botón "Ver detalles" de un escaneo específico | 1. Seleccionar un escaneo histórico<br>2. Clic en Ver Detalles<br>3. Revisar hosts capturados en ese momento | Se abre el modal `ScanDetailModal` con la lista de hosts exacta capturada en dicha fecha. | Se desplegaron los hosts históricos correspondientes al scan_id consultado. | **OK** |

---

### **ÁREA FUNCIONAL 4: Inventario Consolidado de Dispositivos (RF04)**

| No | Caso de Prueba | Prioridad | Precondiciones | Datos de Entrada | Pasos | Resultado Esperado | Resultado Obtenido | Estado |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1.0** | Listar inventario consolidado único por dirección MAC (Happy Path) | **Alta** | Múltiples escaneos ejecutados con los mismos dispositivos físicos. | Navegación a ruta `/devices` | 1. Clic en "Dispositivos" en el Sidebar<br>2. Verificar número de filas y direcciones MAC | Cada dispositivo físico tiene una única entrada en la tabla independientemente de cuántas veces se escaneó. | Consolidación por MAC verificada; no existen registros duplicados de un mismo dispositivo físico. | **OK** |
| **2.0** | Filtrar dispositivos por estado (Conectados, Confiables, Nuevos) | **Alta** | Dispositivos con diferentes estados de presencia y confianza en la BD. | Clic en pestañas de filtro | 1. Seleccionar filtro "Conectados"<br>2. Comprobar que solo muestre `is_present == true`<br>3. Seleccionar "Confiables" | La tabla filtra los registros en memoria de inmediato según el criterio seleccionado. | Los filtros se aplicaron de manera instantánea y precisa. | **OK** |
| **3.0** | Búsqueda reactiva de dispositivos por texto | **Media** | Inventario con varios dispositivos registrados. | Texto en input: ej. "192.168", "Apple", o parte de MAC | 1. Ingresar texto en el campo de búsqueda<br>2. Observar actualización de la tabla | Se filtran únicamente los dispositivos que coinciden con IP, MAC, alias o fabricante. | Búsqueda reactiva funcionó con debounce adecuado y filtrado correcto. | **OK** |
| **4.0** | Auditoría temporal: verificación de first_seen y last_seen | **Media** | Dispositivo detectado en un escaneo anterior y re-detectado en un nuevo escaneo. | Nuevo escaneo con el mismo dispositivo conectado | 1. Registrar `first_seen` inicial<br>2. Ejecutar nuevo escaneo minutos después<br>3. Consultar `/devices` | `first_seen` se mantiene inmutable con la fecha del primer registro; `last_seen` se actualiza a la hora actual. | Las marcas de tiempo de `first_seen` y `last_seen` cumplieron con la lógica de auditoría esperada. | **OK** |

---

### **ÁREA FUNCIONAL 5: Gestión de Confianza y Edición de Alias (RF05)**

| No | Caso de Prueba | Prioridad | Precondiciones | Datos de Entrada | Pasos | Resultado Esperado | Resultado Obtenido | Estado |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1.0** | Asignar y modificar alias personalizado a un dispositivo (Happy Path) | **Alta** | Dispositivo registrado en inventario sin alias. | Nuevo alias: "Laptop Daniel Trabajo" | 1. Abrir `DeviceDetailModal` del host<br>2. Escribir "Laptop Daniel Trabajo" en Alias<br>3. Clic en "Guardar Cambios" | El alias se persiste vía `PATCH /api/devices/{mac}`; la tabla y modales reflejan el nuevo nombre. | El alias se guardó en SQLite y se actualizó en la UI sin recargar la página. | **OK** |
| **2.0** | Clasificar dispositivo como Confiable (trusted = true) | **Alta** | Dispositivo con `trusted == false` o `null`. | Activar switch de "Dispositivo de confianza" | 1. Abrir `DeviceDetailModal`<br>2. Activar switch "Marcar como confiable"<br>3. Clic en "Guardar Cambios" | El estado `trusted` cambia a `true` en BD; el badge visual cambia a verde "Confiable". | El dispositivo fue marcado como confiable y desapareció de la lista de pendientes de revisión. | **OK** |
| **3.0** | Marcar dispositivo como No Confiable y verificar aparición en ReviewCard | **Alta** | Dispositivo marcado previamente como confiable. | Desactivar switch de confianza (`trusted = false`) | 1. Desmarcar "Dispositivo de confianza" en modal<br>2. Guardar cambios<br>3. Regresar al Dashboard | El dispositivo aparece en el Dashboard dentro de las tarjetas `ReviewCard` para alertar al usuario. | `ReviewCard` destacó correctamente el dispositivo marcado como no confiable. | **OK** |

---

### **ÁREA FUNCIONAL 6: Analíticas y Detección de Puertos Críticos (RF06)**

| No | Caso de Prueba | Prioridad | Precondiciones | Datos de Entrada | Pasos | Resultado Esperado | Resultado Obtenido | Estado |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1.0** | Cálculo y renderizado del índice de Salud de la Red (Network Health) | **Alta** | Dispositivos registrados con y sin puertos de riesgo. | Navegación a ruta `/analytics` | 1. Abrir pestaña "Analíticas" en Sidebar<br>2. Observar porcentaje de Salud de la Red | Se muestra un porcentaje entre 0% y 100%, penalizado por la presencia de dispositivos sospechosos o puertos inseguros. | El indicador de salud de red se calculó conforme a la fórmula ponderada de `deviceHelpers.ts`. | **OK** |
| **2.0** | Detección y alerta visual de puertos de alto riesgo (21, 22, 23, 445, 3389) | **Alta** | Al menos un host en la red con puerto sensible abierto (ej. SMB 445 o SSH 22). | Datos de escaneo con puertos críticos expuestos | 1. Ir a la sección "Puertos y Servicios Sensibles" en `/analytics`<br>2. Verificar el recuento de puertos críticos | Se listan los puertos detectados clasificados por nivel de riesgo con advertencias en color rojo/ámbar. | Los puertos críticos fueron detectados y catalogados con su descripción y advertencia correspondiente. | **OK** |
| **3.0** | Renderizado de gráfico de tendencia temporal con Recharts | **Media** | Historial con múltiples escaneos almacenados. | Datos cronológicos de escaneos | 1. Ir a `/analytics`<br>2. Inspeccionar el gráfico de línea de presencia de dispositivos | El gráfico de líneas se renderiza sin errores en consola, con ejes de fecha y puntos interactivos con tooltip. | Gráfico interactivo de Recharts renderizado fluidamente con tooltips informativos. | **OK** |

---

### **ÁREA FUNCIONAL 7: Control de Errores, Conectividad y Resiliencia (RF07 & RF08)**

| No | Caso de Prueba | Prioridad | Precondiciones | Datos de Entrada | Pasos | Resultado Esperado | Resultado Obtenido | Estado |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1.0** | Manejo de excepción cuando Nmap CLI no está instalado en el SO (NMAP_NOT_FOUND) | **Alta** | Sistema anfitrión sin el binario `nmap` en el PATH (o simulación en `test_error_handling.py`). | Petición de escaneo de red | 1. Ejecutar escaneo sin nmap instalado<br>2. Revisar respuesta de API y UI | El backend captura la excepción, retorna HTTP 500 con código `NMAP_NOT_FOUND` y el frontend muestra Toast de error guiado. | Se retornó `NMAP_NOT_FOUND` con código 500 y mensaje amigable sin exponer trazas de servidor (IEEE 730). | **OK** |
| **2.0** | Detección de equipo sin conexión de red antes de escanear (Modo Offline) | **Alta** | Host con interfaces de red inactivas (cable desconectado y Wi-Fi apagado). | Intento de clic en "Escanear Red" | 1. Desactivar adaptadores de red en el host<br>2. Intentar escanear desde la aplicación | El botón de escaneo se desactiva y el componente `StatusBanner` avisa que no hay red disponible. | `useNetworkStatus` detectó la desconexión, deshabilitó el botón y desplegó el banner de advertencia. | **OK** |
| **3.0** | Recuperación ante reinicio imprevisto del servidor durante un escaneo activo | **Media** | Una tarea de escaneo se encuentra en estado `running`. | Reinicio del proceso FastAPI (SIGINT / SIGKILL) | 1. Iniciar un escaneo<br>2. Reiniciar el servidor FastAPI<br>3. Consultar `GET /api/tasks/{task_id}` | Al arrancar, el servidor detecta tareas huérfanas en estado `running` y las actualiza a `failed` con código `SERVER_RESTARTED`. | El backend limpió la tarea huérfana marcándola como `failed` con `SERVER_RESTARTED`, evitando bloqueos indefinidos. | **OK** |
| **4.0** | Etiquetado automático de dispositivos nuevos (is_new = true) | **Alta** | Se conecta un dispositivo con dirección MAC que nunca antes había sido vista. | Escaneo de red que detecta la nueva MAC | 1. Conectar nuevo dispositivo de prueba a la LAN<br>2. Ejecutar escaneo<br>3. Verificar Dashboard y tabla de dispositivos | El dispositivo es marcado con `is_new: true` (`first_seen == last_seen`) y aparece en la sección de revisión prioritaria. | El nuevo equipo fue catalogado con el badge "Nuevo" y presentado en `ReviewCard` para su clasificación. | **OK** |
