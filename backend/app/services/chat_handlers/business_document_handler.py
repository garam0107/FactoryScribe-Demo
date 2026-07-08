from sqlmodel import Session, select

from app.models.business_document import (
    PurchaseOrderDocument,
    PurchaseOrderItem,
    QuotationDocument,
    QuotationItem,
)
from app.services.business_document_service import sync_business_documents
from app.services.chat_handlers.common import (
    HandlerResult,
    format_date,
    format_number,
    row_citation,
    source_dict,
)
from app.services.chat_handlers.entity_extractor import ExtractedEntities


def _normalize(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(str(value).strip().lower().split())


def _contains(value: str | None, keyword: str) -> bool:
    return _normalize(keyword) in _normalize(value)


def _ensure_business_documents_loaded(session: Session, repository_id: str) -> None:
    quote_exists = session.exec(
        select(QuotationDocument.id).where(QuotationDocument.repository_id == repository_id)
    ).first()
    po_exists = session.exec(
        select(PurchaseOrderDocument.id).where(
            PurchaseOrderDocument.repository_id == repository_id
        )
    ).first()
    if quote_exists or po_exists:
        return

    try:
        sync_business_documents(session, repository_id)
    except ValueError:
        return


def _quotation_item_count(session: Session, document_id: str) -> int:
    return len(
        session.exec(
            select(QuotationItem).where(QuotationItem.quotation_document_id == document_id)
        ).all()
    )


def _purchase_order_item_count(session: Session, document_id: str) -> int:
    return len(
        session.exec(
            select(PurchaseOrderItem).where(
                PurchaseOrderItem.purchase_order_document_id == document_id
            )
        ).all()
    )


def handle_business_document_query(
    session: Session,
    repository_id: str,
    message: str,
    entities: ExtractedEntities,
) -> HandlerResult:
    # Document lookups are exact when a PO/QT number exists, otherwise partner-scoped.
    _ensure_business_documents_loaded(session, repository_id)

    wants_quotation = entities.wants_quotation or not entities.wants_purchase_order
    wants_purchase_order = entities.wants_purchase_order or not entities.wants_quotation
    partner_name = entities.partner_names[0] if entities.partner_names else None

    quotations: list[QuotationDocument] = []
    purchase_orders: list[PurchaseOrderDocument] = []

    if wants_quotation:
        all_quotations = session.exec(
            select(QuotationDocument).where(QuotationDocument.repository_id == repository_id)
        ).all()
        quotations = [
            document
            for document in all_quotations
            if (
                entities.quotation_no
                and _normalize(document.quotation_no) == _normalize(entities.quotation_no)
            )
            or (
                partner_name
                and (
                    _contains(document.recipient_company_name, partner_name)
                    or _contains(document.issuer_company_name, partner_name)
                )
            )
            or (not entities.quotation_no and not partner_name)
        ]

    if wants_purchase_order:
        all_purchase_orders = session.exec(
            select(PurchaseOrderDocument).where(
                PurchaseOrderDocument.repository_id == repository_id
            )
        ).all()
        purchase_orders = [
            document
            for document in all_purchase_orders
            if (
                entities.purchase_order_no
                and _normalize(document.purchase_order_no)
                == _normalize(entities.purchase_order_no)
            )
            or (
                partner_name
                and (
                    _contains(document.recipient_company_name, partner_name)
                    or _contains(document.issuer_company_name, partner_name)
                )
            )
            or (not entities.purchase_order_no and not partner_name)
        ]

    if not quotations and not purchase_orders:
        target = partner_name or entities.quotation_no or entities.purchase_order_no or "요청 조건"
        return HandlerResult(
            answer=f"{target}에 해당하는 견적서 또는 발주서는 현재 등록된 데이터에서 확인되지 않습니다.",
            sources=[],
        )

    lines = ["확인된 문서 정보입니다."]
    sources: list[dict] = []

    if quotations:
        lines.append("")
        lines.append(f"견적서: {len(quotations)}건")
        for document in quotations[:10]:
            item_count = _quotation_item_count(session, document.id)
            lines.append(
                f"- {document.quotation_no} / {format_date(document.quotation_date)} / "
                f"{document.recipient_company_name or '-'} / 품목 {format_number(item_count)}건"
            )
            citation = row_citation(
                document.source_filename,
                document.source_sheet_name,
                None,
            )
            sources.append(
                source_dict(
                    source_type="quotation",
                    filename=document.source_filename,
                    citation=citation,
                    document_id=document.id,
                    text=(
                        f"견적서번호={document.quotation_no}, 거래처={document.recipient_company_name}, "
                        f"품목수={item_count}"
                    ),
                )
            )

    if purchase_orders:
        lines.append("")
        lines.append(f"발주서: {len(purchase_orders)}건")
        for document in purchase_orders[:10]:
            item_count = _purchase_order_item_count(session, document.id)
            lines.append(
                f"- {document.purchase_order_no} / {format_date(document.order_date)} / "
                f"{document.recipient_company_name or '-'} / 품목 {format_number(item_count)}건"
            )
            citation = row_citation(
                document.source_filename,
                document.source_sheet_name,
                None,
            )
            sources.append(
                source_dict(
                    source_type="purchase_order",
                    filename=document.source_filename,
                    citation=citation,
                    document_id=document.id,
                    text=(
                        f"발주서번호={document.purchase_order_no}, 거래처={document.recipient_company_name}, "
                        f"품목수={item_count}"
                    ),
                )
            )

    lines.append("")
    lines.append("출처:")
    lines.extend(f"- {source['citation']}" for source in sources)

    return HandlerResult(answer="\n".join(lines), sources=sources)
