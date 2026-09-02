from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class ScanRecord(Base):

    """ 
    Escaneo completo, equivalente a ScanResult
    """

    __tablename__ = "scans"
    id = Column(Integer, primary_key=True, index=True) 
    target = Column(String, nullable= False) #CIDR de la red escaneada
    total_hosts = Column(Integer, nullable= False)
    duration_seconds = Column(Float, nullable= False)
    scanned_at = Column(String, nullable= False) #Timestamp de cuando se registro el escaneo
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    hosts = relationship("HostRecord", back_populates="scan", cascade= "all, delete-orphan")

class HostRecord(Base):
    """
    Host encontrado en un escaneo, equivalente a Host
    """

    __tablename__ = "hosts"

    id=Column(Integer,primary_key=True, index=True)

    scan_id = Column(Integer, ForeignKey("scans.id"), nullable=False)

    ip = Column(String, index=True, nullable=False)
    hostname= Column(String, nullable=True)
    mac= Column(String, nullable=True)
    vendor = Column(String, nullable=True)
    status = Column(String, default = "up")

    scan = relationship("ScanRecord", back_populates="hosts")




