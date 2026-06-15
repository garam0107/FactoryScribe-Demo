from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime


class DocumentRepository(SQLModel, table=True):
    __tablename__ = "document_repositories"

    id: str = Field(primary_key=True)
    name: str
    path: str
    status: str = "active"

    last_indexed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime