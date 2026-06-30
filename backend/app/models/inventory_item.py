from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime


class InventoryItem(SQLModel, table=True):
    __tablename__ = "inventory_items"

    id: str = Field(primary_key=True)
    repository_id: str = Field(index=True)

    item_code: str = Field(index=True)
    item_name: str = Field(index=True)
    category: Optional[str] = None
    spec: Optional[str] = None
    unit: Optional[str] = None
    supplier: Optional[str] = None

    current_stock: float = 0
    safety_stock: Optional[float] = None
    target_stock: Optional[float] = None
    avg_monthly_usage: Optional[float] = None

    current_unit_price: Optional[float] = None
    previous_unit_price: Optional[float] = None
    price_change_rate: Optional[float] = None

    stock_status: Optional[str] = None
    expected_depletion_days: Optional[float] = None
    warehouse_location: Optional[str] = None
    last_inbound_date: Optional[datetime] = None
    note: Optional[str] = None

    source_filename: Optional[str] = None
    source_sheet_name: Optional[str] = None
    source_row: Optional[int] = None

    created_at: datetime
    updated_at: datetime
