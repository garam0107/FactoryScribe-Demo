from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime


class GeneratedFile(SQLModel, table=True):
    __tablename__ = "generated_files"

    id: str = Field(primary_key=True)
    quotation_draft_id: Optional[str] = Field(default=None, index=True)

    file_type: str
    template_path: Optional[str] = None
    output_path: str

    created_at: datetime