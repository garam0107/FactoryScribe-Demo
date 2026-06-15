from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime


class DocumentChunk(SQLModel, table=True):
    __tablename__ = "document_chunks"

    id: str = Field(primary_key=True)
    document_id: str = Field(index=True)

    chunk_index: int
    content_preview: Optional[str] = None

    source_type: str
    page_number: Optional[int] = None
    sheet_name: Optional[str] = None
    row_start: Optional[int] = None
    row_end: Optional[int] = None

    lancedb_id: str = Field(index=True)

    created_at: datetime