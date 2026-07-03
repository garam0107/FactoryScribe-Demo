from sqlalchemy import text
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
    ensure_inventory_item_columns()


def ensure_inventory_item_columns():
    required_columns = {
        "previous_year_usage_quantity": "FLOAT",
        "current_remaining_quantity": "FLOAT",
        "current_year_expected_quantity": "FLOAT",
    }

    with engine.begin() as connection:
        existing_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(inventory_items)"))
        }

        for column_name, column_type in required_columns.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(f"ALTER TABLE inventory_items ADD COLUMN {column_name} {column_type}")
                )


def get_session():
    with Session(engine) as session:
        yield session
