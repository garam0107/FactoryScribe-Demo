from datetime import date, datetime

from pydantic import BaseModel, Field


class BusinessDocumentSyncResponse(BaseModel):
    repository_id: str
    files: list[str]
    quotation_documents: int
    quotation_items: int
    purchase_order_documents: int
    purchase_order_items: int


class QuotationItemResponse(BaseModel):
    id: str
    quotation_document_id: str
    repository_id: str
    item_code: str
    item_name: str
    spec: str | None = None
    quantity: float
    unit_price: float | None = None
    supply_amount: float | None = None
    tax_amount: float | None = None
    total_amount: float | None = None
    source_row: int | None = None
    created_at: datetime
    updated_at: datetime


class QuotationDocumentResponse(BaseModel):
    id: str
    repository_id: str
    quotation_no: str
    quotation_date: date | None = None
    recipient_company_name: str | None = None
    issuer_company_name: str | None = None
    project_name: str | None = None
    delivery_terms: str | None = None
    payment_terms: str | None = None
    valid_until_text: str | None = None
    source_filename: str | None = None
    source_sheet_name: str | None = None
    created_at: datetime
    updated_at: datetime
    items: list[QuotationItemResponse] = Field(default_factory=list)


class PurchaseOrderItemResponse(BaseModel):
    id: str
    purchase_order_document_id: str
    repository_id: str
    item_code: str
    item_name: str
    spec: str | None = None
    unit: str | None = None
    quantity: float
    requested_delivery_date: date | None = None
    unit_price: float | None = None
    status_text: str | None = None
    note: str | None = None
    source_row: int | None = None
    created_at: datetime
    updated_at: datetime


class PurchaseOrderDocumentResponse(BaseModel):
    id: str
    repository_id: str
    purchase_order_no: str
    order_date: date | None = None
    recipient_company_name: str | None = None
    issuer_company_name: str | None = None
    project_name: str | None = None
    issuer_contact_name: str | None = None
    issuer_contact_text: str | None = None
    source_filename: str | None = None
    source_sheet_name: str | None = None
    created_at: datetime
    updated_at: datetime
    items: list[PurchaseOrderItemResponse] = Field(default_factory=list)
