import pytest
from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.db import models  # noqa: F401


TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture
def db_session():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture(autouse=True)
def _no_mac_vendor_download(monkeypatch):
    """Evita que MacLookup.update_vendors() salga a internet."""
    monkeypatch.setattr(
        "app.scanners.nmap_scanner.MacLookup.update_vendors",
        lambda self, *a, **kw: None,
    )


@pytest.fixture(autouse=True)
def _fast_own_ip_detection(monkeypatch):
    """Evita que NmapScanner._detect_own_ip() abra socket a 8.8.8.8."""
    monkeypatch.setattr(
        "app.scanners.nmap_scanner.NmapScanner._detect_own_ip",
        lambda self: "10.10.0.87",
    )