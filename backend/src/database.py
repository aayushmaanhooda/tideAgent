from sqlmodel import Session, SQLModel, create_engine
from src.config import settings
from src.models import LabeledData  # noqa: F401

url = settings.database_url

engine = create_engine(url, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
