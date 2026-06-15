from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime


class QuotationDraft(SQLModel, table=True):
    __tablename__ = "quotation_drafts"

    id: str = Field(primary_key=True)
    conversation_id: Optional[str] = Field(default=None, index=True)

    status: str = "draft"
    customer_name: Optional[str] = None
    project_name: Optional[str] = None

    draft_json: str

    created_at: datetime
    updated_at: datetime