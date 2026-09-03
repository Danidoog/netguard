
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

#directorio base del proyecto
APP_DIR = Path(__file__).resolve().parent.parent

#DB_DIR = os.path.join(BASE_DIR, "db")
DB_DIR = APP_DIR / "db"
DB_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_DIR / 'netguard.db'}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush= False, bind= engine)
Base = declarative_base()