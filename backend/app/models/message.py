from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: str = Field(primary_key=True)
    conversation_id: str = Field(index=True)

    role: str
    content: str

    created_at: datetime


class MessageSource(SQLModel, table=True):
    __tablename__ = "message_sources"

    id: str = Field(primary_key=True)
    message_id: str = Field(index=True)
    document_id: str = Field(index=True)

    chunk_id: Optional[str] = Field(default=None, index=True)
    score: Optional[float] = None
    citation_text: Optional[str] = None

    created_at: datetime