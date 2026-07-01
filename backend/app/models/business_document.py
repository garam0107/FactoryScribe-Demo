from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class QuotationDocument(SQLModel, table=True):
    __tablename__ = "quotation_documents"

    id: str = Field(primary_key=True)
    repository_id: str = Field(index=True)

    quotation_no: str = Field(index=True)
    quotation_date: Optional[date] = Field(default=None, index=True)
    recipient_company_name: Optional[str] = Field(default=None, index=True)
    issuer_company_name: Optional[str] = Field(default=None, index=True)
    project_name: Optional[str] = None
    delivery_terms: Optional[str] = None
    payment_terms: Optional[str] = None
    valid_until_text: Optional[str] = None

    source_filename: Optional[str] = None
    source_sheet_name: Optional[str] = None

    created_at: datetime
    updated_at: datetime


class QuotationItem(SQLModel, table=True):
    __tablename__ = "quotation_items"

    id: str = Field(primary_key=True)
    quotation_document_id: str = Field(index=True)
    repository_id: str = Field(index=True)

    item_code: str = Field(index=True)
    item_name: str = Field(index=True)
    spec: Optional[str] = None
    quantity: float
    unit_price: Optional[float] = None
    supply_amount: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None

    source_row: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class PurchaseOrderDocument(SQLModel, table=True):
    __tablename__ = "purchase_order_documents"

    id: str = Field(primary_key=True)
    repository_id: str = Field(index=True)

    purchase_order_no: str = Field(index=True)
    order_date: Optional[date] = Field(default=None, index=True)
    recipient_company_name: Optional[str] = Field(default=None, index=True)
    issuer_company_name: Optional[str] = Field(default=None, index=True)
    project_name: Optional[str] = None
    issuer_contact_name: Optional[str] = None
    issuer_contact_text: Optional[str] = None

    source_filename: Optional[str] = None
    source_sheet_name: Optional[str] = None

    created_at: datetime
    updated_at: datetime


class PurchaseOrderItem(SQLModel, table=True):
    __tablename__ = "purchase_order_items"

    id: str = Field(primary_key=True)
    purchase_order_document_id: str = Field(index=True)
    repository_id: str = Field(index=True)

    item_code: str = Field(index=True)
    item_name: str = Field(index=True)
    spec: Optional[str] = None
    unit: Optional[str] = None
    quantity: float
    requested_delivery_date: Optional[date] = Field(default=None, index=True)
    unit_price: Optional[float] = None
    status_text: Optional[str] = None
    note: Optional[str] = None

    source_row: Optional[int] = None
    created_at: datetime
    updated_at: datetime
