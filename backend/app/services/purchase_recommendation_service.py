from sqlmodel import Session, select

from app.models.business_document import QuotationDocument, QuotationItem
from app.models.inventory_item import InventoryItem
from app.models.repository import DocumentRepository
from app.schemas.purchase_recommendation import RequiredOrderItemResponse


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""

    return "".join(str(value).strip().lower().split())


def list_required_order_items(
    session: Session,
    repository_id: str,
) -> list[RequiredOrderItemResponse]:
    repo = session.get(DocumentRepository, repository_id)
    if not repo:
        raise ValueError("repository not found")

    inventory_items = session.exec(
        select(InventoryItem).where(InventoryItem.repository_id == repository_id)
    ).all()
    if not inventory_items:
        raise ValueError("inventory items not loaded")

    quotation_documents = session.exec(
        select(QuotationDocument)
        .where(QuotationDocument.repository_id == repository_id)
        .order_by(
            QuotationDocument.quotation_date.desc(),
            QuotationDocument.quotation_no.desc(),
        )
    ).all()
    if not quotation_documents:
        raise ValueError("quotation documents not loaded")

    inventory_codes = {
        _normalize_text(item.item_code)
        for item in inventory_items
        if _normalize_text(item.item_code)
    }
    inventory_names = {
        _normalize_text(item.item_name)
        for item in inventory_items
        if _normalize_text(item.item_name)
    }

    required_items: list[RequiredOrderItemResponse] = []
    for document in quotation_documents:
        quotation_items = session.exec(
            select(QuotationItem)
            .where(QuotationItem.quotation_document_id == document.id)
            .order_by(QuotationItem.source_row.asc())
        ).all()

        for item in quotation_items:
            item_code = _normalize_text(item.item_code)
            item_name = _normalize_text(item.item_name)
            exists_in_inventory = (
                bool(item_code and item_code in inventory_codes)
                or bool(item_name and item_name in inventory_names)
            )
            if exists_in_inventory:
                continue

            required_items.append(
                RequiredOrderItemResponse(
                    quotation_item_id=item.id,
                    quotation_document_id=document.id,
                    quotation_no=document.quotation_no,
                    item_code=item.item_code,
                    item_name=item.item_name,
                    customer_name=document.recipient_company_name,
                    unit_price=item.unit_price,
                    delivery_deadline=document.delivery_terms,
                )
            )

    return required_items
