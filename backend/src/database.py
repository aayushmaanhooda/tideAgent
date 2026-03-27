from sqlmodel import Session, SQLModel, create_engine
from src.config import settings
from src.models import LabeledData  # noqa: F401

url = settings.database_url

engine = create_engine(
    url,
    echo=True,
    pool_pre_ping=True,       # test connection before using it — detects stale SSL connections
    pool_recycle=300,         # recycle connections every 5 min (Neon closes idle after ~5 min)
    pool_size=5,
    max_overflow=10,
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
