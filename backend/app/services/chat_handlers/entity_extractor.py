import re
from dataclasses import dataclass, field

from sqlmodel import Session, select

from app.models.business_document import PurchaseOrderDocument, QuotationDocument
from app.models.inventory_item import InventoryItem
from app.models.transaction_record import TransactionRecord


@dataclass
class ExtractedEntities:
    item_names: list[str] = field(default_factory=list)
    item_codes: list[str] = field(default_factory=list)
    partner_names: list[str] = field(default_factory=list)
    quotation_no: str | None = None
    purchase_order_no: str | None = None
    wants_quotation: bool = False
    wants_purchase_order: bool = False

    def to_dict(self) -> dict:
        return {
            "item_names": self.item_names,
            "item_codes": self.item_codes,
            "partner_names": self.partner_names,
            "quotation_no": self.quotation_no,
            "purchase_order_no": self.purchase_order_no,
            "wants_quotation": self.wants_quotation,
            "wants_purchase_order": self.wants_purchase_order,
        }


def _normalize(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(str(value).strip().lower().split())


def _append_unique(items: list[str], value: str | None) -> None:
    if value and value not in items:
        items.append(value)


def _contains_candidate(message: str, candidate: str | None) -> bool:
    if not candidate:
        return False

    return _normalize(candidate) in _normalize(message)


def extract_entities(session: Session, repository_id: str, message: str) -> ExtractedEntities:
    # Prefer exact candidates already loaded from the demo XLSX tables.
    entities = ExtractedEntities(
        wants_quotation="견적서" in message or bool(re.search(r"\bQT-\d", message, flags=re.I)),
        wants_purchase_order="발주서" in message or bool(
            re.search(r"\bPO-\d", message, flags=re.I)
        ),
    )

    quote_match = re.search(r"\bQT-\d{4}-\d+\b", message, flags=re.I)
    if quote_match:
        entities.quotation_no = quote_match.group(0).upper()

    po_match = re.search(r"\bPO-\d{4}-\d+\b", message, flags=re.I)
    if po_match:
        entities.purchase_order_no = po_match.group(0).upper()

    inventory_items = session.exec(
        select(InventoryItem).where(InventoryItem.repository_id == repository_id)
    ).all()
    for item in inventory_items:
        if _contains_candidate(message, item.item_name):
            _append_unique(entities.item_names, item.item_name)
        if _contains_candidate(message, item.item_code):
            _append_unique(entities.item_codes, item.item_code)
        if _contains_candidate(message, item.supplier):
            _append_unique(entities.partner_names, item.supplier)

    transaction_records = session.exec(
        select(TransactionRecord).where(TransactionRecord.repository_id == repository_id)
    ).all()
    for record in transaction_records:
        if _contains_candidate(message, record.partner_name):
            _append_unique(entities.partner_names, record.partner_name)
        if _contains_candidate(message, record.item_name):
            _append_unique(entities.item_names, record.item_name)
        if _contains_candidate(message, record.item_code):
            _append_unique(entities.item_codes, record.item_code)

    quotation_documents = session.exec(
        select(QuotationDocument).where(QuotationDocument.repository_id == repository_id)
    ).all()
    for document in quotation_documents:
        if _contains_candidate(message, document.recipient_company_name):
            _append_unique(entities.partner_names, document.recipient_company_name)
        if _contains_candidate(message, document.issuer_company_name):
            _append_unique(entities.partner_names, document.issuer_company_name)
        if _contains_candidate(message, document.quotation_no):
            entities.quotation_no = document.quotation_no

    purchase_order_documents = session.exec(
        select(PurchaseOrderDocument).where(PurchaseOrderDocument.repository_id == repository_id)
    ).all()
    for document in purchase_order_documents:
        if _contains_candidate(message, document.recipient_company_name):
            _append_unique(entities.partner_names, document.recipient_company_name)
        if _contains_candidate(message, document.issuer_company_name):
            _append_unique(entities.partner_names, document.issuer_company_name)
        if _contains_candidate(message, document.purchase_order_no):
            entities.purchase_order_no = document.purchase_order_no

    # If the partner has not been synced into structured tables yet, capture common
    # Korean company-name phrases so the handler can still answer deterministically.
    if not entities.partner_names:
        partner_patterns = [
            r"([가-힣A-Za-z0-9&().\s]{2,30})(?:\s*거래처|\s*랑|\s*이랑|\s*와|\s*과|\s*하고|\s*업체|\s*회사)",
            r"([가-힣A-Za-z0-9&().\s]{2,30})(?:\s*견적서|\s*발주서)",
        ]
        for pattern in partner_patterns:
            for match in re.finditer(pattern, message):
                candidate = match.group(1).strip()
                for noise in ["아니 내가", "내가", "혹시", "정말"]:
                    candidate = candidate.replace(noise, "").strip()
                if candidate:
                    _append_unique(entities.partner_names, candidate)

    if not entities.partner_names:
        for match in re.finditer(r"([가-힣A-Za-z0-9&().\s]{2,30})(?:\s*건)", message):
            candidate = match.group(1).strip()
            for noise in ["아니 내가", "내가", "혹시", "정말"]:
                candidate = candidate.replace(noise, "").strip()
            if candidate:
                _append_unique(entities.partner_names, candidate)

    return entities
