from sqlmodel import Session, select

from app.models.business_document import PurchaseOrderDocument, QuotationDocument
from app.models.transaction_record import TransactionRecord
from app.services.business_document_service import sync_business_documents
from app.services.chat_handlers.common import (
    HandlerResult,
    format_date,
    format_number,
    row_citation,
    source_dict,
)
from app.services.chat_handlers.entity_extractor import ExtractedEntities
from app.services.transaction_service import sync_transaction_records


def _normalize(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(str(value).strip().lower().split())


def _contains(value: str | None, keyword: str) -> bool:
    return _normalize(keyword) in _normalize(value)


def _ensure_transactions_loaded(session: Session, repository_id: str) -> None:
    exists = session.exec(
        select(TransactionRecord.id).where(TransactionRecord.repository_id == repository_id)
    ).first()
    if exists:
        return

    try:
        sync_transaction_records(session, repository_id)
    except ValueError:
        return


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


def handle_partner_history_query(
    session: Session,
    repository_id: str,
    message: str,
    entities: ExtractedEntities,
) -> HandlerResult:
    # Partner history checks all structured sources and never substitutes
    # a different partner when the requested partner has no matches.
    _ensure_transactions_loaded(session, repository_id)
    _ensure_business_documents_loaded(session, repository_id)

    if not entities.partner_names:
        return HandlerResult(
            answer="어떤 거래처의 거래 내역을 확인할지 거래처명을 알려주세요.",
            sources=[],
        )

    partner_name = entities.partner_names[0]

    transactions = [
        record
        for record in session.exec(
            select(TransactionRecord).where(TransactionRecord.repository_id == repository_id)
        ).all()
        if _contains(record.partner_name, partner_name)
    ]
    quotations = [
        document
        for document in session.exec(
            select(QuotationDocument).where(QuotationDocument.repository_id == repository_id)
        ).all()
        if _contains(document.recipient_company_name, partner_name)
        or _contains(document.issuer_company_name, partner_name)
    ]
    purchase_orders = [
        document
        for document in session.exec(
            select(PurchaseOrderDocument).where(
                PurchaseOrderDocument.repository_id == repository_id
            )
        ).all()
        if _contains(document.recipient_company_name, partner_name)
        or _contains(document.issuer_company_name, partner_name)
    ]

    if not transactions and not quotations and not purchase_orders:
        return HandlerResult(
            answer=(
                f"{partner_name}과의 거래 내역은 현재 등록된 입출고내역, "
                "견적서, 발주서에서 확인되지 않습니다."
            ),
            sources=[],
        )

    sources: list[dict] = []
    lines = [f"{partner_name}과의 거래 내역이 확인됩니다.", ""]
    lines.append(f"- 입출고내역: {len(transactions)}건")
    lines.append(f"- 견적서: {len(quotations)}건")
    lines.append(f"- 발주서: {len(purchase_orders)}건")

    if transactions:
        lines.append("")
        lines.append("입출고내역 주요 내역:")
        for record in transactions[:5]:
            lines.append(
                "- "
                f"{format_date(record.transaction_date)} / {record.item_name} / "
                f"{record.transaction_type or '-'} / 수량 {format_number(record.quantity)} / "
                f"단가 {format_number(record.unit_price)}원"
            )
            citation = row_citation(
                record.source_filename,
                record.source_sheet_name,
                record.source_row,
            )
            sources.append(
                source_dict(
                    source_type="transaction",
                    filename=record.source_filename,
                    row=record.source_row,
                    citation=citation,
                    text=(
                        f"거래처={record.partner_name}, 거래일자={format_date(record.transaction_date)}, "
                        f"품목명={record.item_name}, 거래유형={record.transaction_type}, "
                        f"수량={record.quantity}, 단가={record.unit_price}"
                    ),
                )
            )

    if quotations:
        lines.append("")
        lines.append("견적서:")
        for document in quotations[:5]:
            lines.append(
                f"- {document.quotation_no} / {format_date(document.quotation_date)} / "
                f"{document.recipient_company_name or document.issuer_company_name or '-'}"
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
                        f"발행처={document.issuer_company_name}, 프로젝트={document.project_name}"
                    ),
                )
            )

    if purchase_orders:
        lines.append("")
        lines.append("발주서:")
        for document in purchase_orders[:5]:
            lines.append(
                f"- {document.purchase_order_no} / {format_date(document.order_date)} / "
                f"{document.recipient_company_name or document.issuer_company_name or '-'}"
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
                        f"발행처={document.issuer_company_name}, 프로젝트={document.project_name}"
                    ),
                )
            )

    lines.append("")
    lines.append("출처:")
    lines.extend(f"- {source['citation']}" for source in sources[:10])

    return HandlerResult(answer="\n".join(lines), sources=sources[:10])
