class NetGuardError(Exception):
    """
    Excepción base de la aplicación. Toda excepción propia de NetGuard
    hereda de esta clase, para que un único exception_handler en FastAPI
    pueda convertir cualquiera de ellas en una respuesta HTTP consistente
    ({"error": {"code": ..., "message": ...}}).
    """

    code = "INTERNAL_ERROR"
    http_status = 500

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class InvalidTargetError(NetGuardError):
    """La red/IP a escanear no es un CIDR o dirección válida."""
    code = "INVALID_TARGET"
    http_status = 400


class NmapNotFoundError(NetGuardError):
    """Nmap no está instalado o no se encuentra en el PATH del sistema."""
    code = "NMAP_NOT_FOUND"
    http_status = 500


class ScanTimeoutError(NetGuardError):
    """El proceso de Nmap superó el tiempo límite configurado."""
    code = "SCAN_TIMEOUT"
    http_status = 504


class ScanFailedError(NetGuardError):
    """Nmap se ejecutó pero terminó con error, o no se pudo determinar
    la red a escanear."""
    code = "SCAN_FAILED"
    http_status = 500