from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime


class Conversation(SQLModel, table=True):
    __tablename__ = "conversations"

    id: str = Field(primary_key=True)
    repository_id: Optional[str] = Field(default=None, index=True)
    title: Optional[str] = None

    created_at: datetime
    updated_at: datetime