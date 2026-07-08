from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class TransactionRecord(SQLModel, table=True):
    """Structured rows parsed from the demo inbound/outbound XLSX format."""

    __tablename__ = "transaction_records"

    id: str = Field(primary_key=True)
    repository_id: str = Field(index=True)

    transaction_date: Optional[datetime] = Field(default=None, index=True)
    transaction_no: Optional[str] = Field(default=None, index=True)
    item_code: Optional[str] = Field(default=None, index=True)
    item_name: Optional[str] = Field(default=None, index=True)
    transaction_type: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    amount: Optional[float] = None
    partner_name: Optional[str] = Field(default=None, index=True)
    project_or_order_no: Optional[str] = Field(default=None, index=True)
    warehouse_location: Optional[str] = None
    manager_name: Optional[str] = None

    source_filename: Optional[str] = None
    source_sheet_name: Optional[str] = None
    source_row: Optional[int] = None

    created_at: datetime
    updated_at: datetime
