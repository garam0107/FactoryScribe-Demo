from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime


class Document(SQLModel, table=True):
    __tablename__ = "documents"

    id: str = Field(primary_key=True)
    repository_id: str = Field(index=True)

    filename: str
    file_path: str
    file_ext: str = Field(index=True)
    file_size: Optional[int] = None
    file_hash: Optional[str] = Field(default=None, index=True)

    indexed_status: str = Field(default="pending", index=True)
    error_message: Optional[str] = None

    created_at: datetime
    updated_at: datetime