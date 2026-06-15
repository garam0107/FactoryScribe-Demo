from sqlmodel import SQLModel, Session, create_engine
from app.config import settings

sqlite_url = f"sqlite:///{settings.sqlite_path}"

engine = create_engine(
    sqlite_url,
    echo=False,
    connect_args={"check_same_thread": False},
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session