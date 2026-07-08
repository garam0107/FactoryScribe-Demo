from collections.abc import Iterable
from datetime import date, datetime
from typing import Any

from sqlmodel import Session, select

from app.models.business_document import (
    PurchaseOrderDocument,
    PurchaseOrderItem,
    QuotationDocument,
    QuotationItem,
)
from app.models.inventory_item import InventoryItem
from app.models.transaction_record import TransactionRecord
from app.services.chat_handlers.common import HandlerResult, format_date, format_number
from app.services.purchase_recommendation_service import list_required_order_items


TABLES = {
    "inventory_items": InventoryItem,
    "transaction_records": TransactionRecord,
    "quotation_documents": QuotationDocument,
    "quotation_items": QuotationItem,
    "purchase_order_documents": PurchaseOrderDocument,
    "purchase_order_items": PurchaseOrderItem,
}

ALLOWED_FIELDS: dict[str, set[str]] = {
    "inventory_items": {
        "id",
        "item_code",
        "item_name",
        "category",
        "spec",
        "unit",
        "supplier",
        "current_stock",
        "safety_stock",
        "target_stock",
        "avg_monthly_usage",
        "previous_year_usage_quantity",
        "current_remaining_quantity",
        "current_year_expected_quantity",
        "current_unit_price",
        "previous_unit_price",
        "price_change_rate",
        "stock_status",
        "expected_depletion_days",
        "warehouse_location",
        "source_filename",
        "source_sheet_name",
        "source_row",
    },
    "transaction_records": {
        "id",
        "transaction_date",
        "transaction_no",
        "item_code",
        "item_name",
        "transaction_type",
        "quantity",
        "unit_price",
        "amount",
        "partner_name",
        "project_or_order_no",
        "warehouse_location",
        "manager_name",
        "source_filename",
        "source_sheet_name",
        "source_row",
    },
    "quotation_documents": {
        "id",
        "partner_name",
        "quotation_no",
        "quotation_date",
        "recipient_company_name",
        "issuer_company_name",
        "project_name",
        "delivery_terms",
        "payment_terms",
        "valid_until_text",
        "source_filename",
        "source_sheet_name",
    },
    "quotation_items": {
        "id",
        "quotation_document_id",
        "item_code",
        "item_name",
        "spec",
        "quantity",
        "unit_price",
        "supply_amount",
        "tax_amount",
        "total_amount",
        "source_row",
    },
    "purchase_order_documents": {
        "id",
        "partner_name",
        "purchase_order_no",
        "order_date",
        "recipient_company_name",
        "issuer_company_name",
        "project_name",
        "issuer_contact_name",
        "issuer_contact_text",
        "source_filename",
        "source_sheet_name",
    },
    "purchase_order_items": {
        "id",
        "purchase_order_document_id",
        "item_code",
        "item_name",
        "spec",
        "unit",
        "quantity",
        "requested_delivery_date",
        "unit_price",
        "status_text",
        "note",
        "source_row",
    },
}

ALLOWED_OPERATIONS = {
    "find",
    "list",
    "exists",
    "count",
    "sum",
    "top_n",
    "bottom_n",
    "summary",
    "required_orders",
    "deadline_required",
    "general_search",
}

DEFAULT_FIELDS = {
    "inventory_items": ["item_name", "item_code", "current_remaining_quantity", "current_stock", "current_unit_price", "supplier"],
    "transaction_records": ["transaction_date", "partner_name", "item_name", "transaction_type", "quantity", "unit_price"],
    "quotation_documents": ["quotation_no", "quotation_date", "recipient_company_name", "project_name"],
    "quotation_items": ["item_name", "item_code", "quantity", "unit_price", "total_amount"],
    "purchase_order_documents": ["purchase_order_no", "order_date", "recipient_company_name", "project_name"],
    "purchase_order_items": ["item_name", "item_code", "quantity", "requested_delivery_date", "unit_price", "status_text"],
}


def _tables_from_plan(plan: dict) -> list[str]:
    tables = []
    table = plan.get("table")
    if isinstance(table, str):
        tables.append(table)
    plan_tables = plan.get("tables")
    if isinstance(plan_tables, list):
        tables.extend(t for t in plan_tables if isinstance(t, str))
    return list(dict.fromkeys(tables))


def _is_allowed_plan(plan: dict) -> bool:
    if plan.get("answerable") is False:
        return True

    operation = plan.get("operation")
    if operation not in ALLOWED_OPERATIONS:
        return False

    if operation in {"required_orders", "deadline_required", "general_search"}:
        return True

    tables = _tables_from_plan(plan)
    if not tables or any(table not in TABLES for table in tables):
        return False

    filters = plan.get("filters") if isinstance(plan.get("filters"), dict) else {}
    for key in filters:
        if not any(key in ALLOWED_FIELDS[table] for table in tables):
            return False

    sort = plan.get("sort") if isinstance(plan.get("sort"), dict) else {}
    sort_field = sort.get("field")
    if sort_field and not any(sort_field in ALLOWED_FIELDS[table] for table in tables):
        return False

    answer_fields = plan.get("answer_fields")
    if isinstance(answer_fields, list):
        for field in answer_fields:
            if not any(field in ALLOWED_FIELDS[table] for table in tables):
                return False

    return True


def _value_text(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, datetime):
        return format_date(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (int, float)):
        return format_number(value)
    return str(value)


def _matches_filter(row: Any, field: str, expected: Any) -> bool:
    if field == "partner_name" and not hasattr(row, field):
        partner_values = [
            getattr(row, "recipient_company_name", None),
            getattr(row, "issuer_company_name", None),
        ]
        return any(_matches_text_value(value, expected) for value in partner_values if value)

    actual = getattr(row, field, None)
    if expected is None or expected == "":
        return True
    if actual is None:
        return False
    if isinstance(expected, list):
        return any(_matches_filter(row, field, item) for item in expected)
    if isinstance(actual, str):
        return _matches_text_value(actual, expected)
    return str(actual).strip().lower() == str(expected).strip().lower()


def _matches_text_value(actual: str | None, expected: Any) -> bool:
    if actual is None:
        return False
    if isinstance(expected, list):
        return any(_matches_text_value(actual, item) for item in expected)
    return str(expected).strip().lower() in actual.strip().lower()


def _apply_filters(rows: Iterable[Any], filters: dict) -> list[Any]:
    if not filters:
        return list(rows)

    filtered = []
    for row in rows:
        keep = True
        for field, expected in filters.items():
            if not hasattr(row, field):
                continue
            if not _matches_filter(row, field, expected):
                keep = False
                break
        if keep:
            filtered.append(row)
    return filtered


def _source_for_row(table: str, row: Any, session: Session) -> dict:
    filename = getattr(row, "source_filename", None)
    sheet = getattr(row, "source_sheet_name", None)
    source_row = getattr(row, "source_row", None)

    if table == "quotation_items":
        document = session.get(QuotationDocument, getattr(row, "quotation_document_id", ""))
        if document:
            filename = document.source_filename
            sheet = document.source_sheet_name
    elif table == "purchase_order_items":
        document = session.get(PurchaseOrderDocument, getattr(row, "purchase_order_document_id", ""))
        if document:
            filename = document.source_filename
            sheet = document.source_sheet_name

    citation_parts = [filename or "출처 파일 미확인"]
    if sheet:
        citation_parts.append(sheet)
    if source_row:
        citation_parts.append(f"Row {source_row}")

    return {
        "document_id": getattr(row, "id", None),
        "chunk_id": None,
        "filename": filename,
        "citation": " / ".join(citation_parts),
        "score": None,
        "source_type": table,
        "row": source_row,
        "text": "",
    }


def _row_summary(table: str, row: Any, fields: list[str], session: Session) -> tuple[str, dict]:
    values = []
    for field in fields:
        if hasattr(row, field):
            values.append(f"{field}={_value_text(getattr(row, field))}")
    source = _source_for_row(table, row, session)
    source["text"] = ", ".join(values)
    return "- " + " / ".join(values), source


def _load_rows(session: Session, repository_id: str, table: str) -> list[Any]:
    model = TABLES[table]
    return session.exec(select(model).where(model.repository_id == repository_id)).all()


def _execute_single_table_plan(
    session: Session,
    repository_id: str,
    plan: dict,
    table: str,
) -> HandlerResult:
    operation = plan.get("operation")
    rows = _load_rows(session, repository_id, table)
    filters = plan.get("filters") if isinstance(plan.get("filters"), dict) else {}
    rows = _apply_filters(rows, filters)

    sort = plan.get("sort") if isinstance(plan.get("sort"), dict) else {}
    sort_field = sort.get("field")
    if sort_field and all(hasattr(row, sort_field) for row in rows):
        reverse = sort.get("direction") == "desc" or operation == "top_n"
        rows.sort(key=lambda row: getattr(row, sort_field) if getattr(row, sort_field) is not None else -1, reverse=reverse)
    elif operation == "bottom_n":
        rows.sort(key=lambda row: getattr(row, "id", ""))

    limit = plan.get("limit") if isinstance(plan.get("limit"), int) else 10
    limit = max(1, min(limit, 20))

    if operation == "count":
        return HandlerResult(answer=f"현재 등록된 데이터에서 조건에 맞는 {table} 결과는 {len(rows)}건입니다.", sources=[])

    if operation == "exists":
        if not rows:
            return HandlerResult(answer="현재 등록된 데이터에서 해당 조건은 확인되지 않습니다.", sources=[])
        fields = plan.get("answer_fields") if isinstance(plan.get("answer_fields"), list) else DEFAULT_FIELDS[table]
        line, source = _row_summary(table, rows[0], fields, session)
        return HandlerResult(answer=f"현재 등록된 데이터에서 해당 조건이 확인됩니다.\n{line}\n\n출처:\n- {source['citation']}", sources=[source])

    if operation == "sum":
        field = sort_field or plan.get("field")
        if not field or field not in ALLOWED_FIELDS[table]:
            return HandlerResult(answer="합계를 계산할 필드를 확인할 수 없습니다.", sources=[])
        total = sum((getattr(row, field, 0) or 0) for row in rows)
        return HandlerResult(answer=f"현재 등록된 데이터 기준 {field} 합계는 {format_number(total)}입니다.", sources=[])

    if operation == "summary":
        return _summary_result(session, rows, table)

    selected = rows[:limit]
    if not selected:
        return HandlerResult(answer="현재 등록된 데이터에서 해당 조건은 확인되지 않습니다.", sources=[])

    fields = plan.get("answer_fields") if isinstance(plan.get("answer_fields"), list) else DEFAULT_FIELDS[table]
    fields = [field for field in fields if field in ALLOWED_FIELDS[table]]
    lines = [f"현재 등록된 데이터에서 {len(selected)}건을 확인했습니다."]
    sources = []
    for row in selected:
        line, source = _row_summary(table, row, fields, session)
        lines.append(line)
        sources.append(source)
    lines.append("")
    lines.append("출처:")
    lines.extend(f"- {source['citation']}" for source in sources)
    return HandlerResult(answer="\n".join(lines), sources=sources)


def _summary_result(session: Session, rows: list[Any], table: str) -> HandlerResult:
    if table == "inventory_items":
        shortage = [
            row
            for row in rows
            if row.target_stock is not None
            and (row.current_remaining_quantity if row.current_remaining_quantity is not None else row.current_stock)
            < row.target_stock
        ]
        total_current = sum(row.current_stock or 0 for row in rows)
        total_remaining = sum(
            row.current_remaining_quantity if row.current_remaining_quantity is not None else row.current_stock
            for row in rows
        )
        answer = (
            "현재 등록된 재고 요약입니다.\n"
            f"- 전체 품목 수: {format_number(len(rows))}건\n"
            f"- 현재고 합계: {format_number(total_current)}\n"
            f"- 잔여수량 합계: {format_number(total_remaining)}\n"
            f"- 부족 품목 수: {format_number(len(shortage))}건"
        )
        return HandlerResult(answer=answer, sources=[])

    return HandlerResult(answer=f"현재 등록된 {table} 데이터는 {len(rows)}건입니다.", sources=[])


def _execute_multi_table_plan(
    session: Session,
    repository_id: str,
    plan: dict,
    tables: list[str],
) -> HandlerResult:
    filters = plan.get("filters") if isinstance(plan.get("filters"), dict) else {}
    limit = plan.get("limit") if isinstance(plan.get("limit"), int) else 5
    lines = ["현재 등록된 데이터에서 여러 테이블을 확인했습니다."]
    sources = []
    total_count = 0

    for table in tables:
        rows = _apply_filters(_load_rows(session, repository_id, table), filters)
        total_count += len(rows)
        lines.append(f"- {table}: {len(rows)}건")
        for row in rows[:limit]:
            fields = DEFAULT_FIELDS[table]
            line, source = _row_summary(table, row, fields, session)
            lines.append(f"  {line}")
            sources.append(source)

    if total_count == 0:
        return HandlerResult(answer="현재 등록된 데이터에서 해당 조건은 확인되지 않습니다.", sources=[])

    lines.append("")
    lines.append("출처:")
    lines.extend(f"- {source['citation']}" for source in sources[:15])
    return HandlerResult(answer="\n".join(lines), sources=sources[:15])


def _execute_required_orders(session: Session, repository_id: str, plan: dict) -> HandlerResult:
    try:
        items = list_required_order_items(session, repository_id)
    except ValueError:
        items = []

    if not items:
        return HandlerResult(answer="현재 등록된 데이터 기준 발주가 필요한 품목은 확인되지 않습니다.", sources=[])

    lines = [f"현재 등록된 데이터 기준 발주 필요 후보는 {len(items)}건입니다."]
    sources = []
    for item in items[:10]:
        lines.append(
            f"- {item.item_name}({item.item_code}) / 견적서 {item.quotation_no} / "
            f"거래처 {item.customer_name or '-'} / 단가 {format_number(item.unit_price)}원"
        )
        document = session.get(QuotationDocument, item.quotation_document_id)
        citation = "출처 파일 미확인"
        filename = None
        if document:
            filename = document.source_filename
            citation = " / ".join(part for part in [document.source_filename, document.source_sheet_name] if part)
        sources.append(
            {
                "document_id": item.quotation_document_id,
                "chunk_id": None,
                "filename": filename,
                "citation": citation,
                "score": None,
                "source_type": "quotation_required_order",
                "row": None,
                "text": f"품목명={item.item_name}, 품목코드={item.item_code}, 견적서번호={item.quotation_no}",
            }
        )

    lines.append("")
    lines.append("출처:")
    lines.extend(f"- {source['citation']}" for source in sources)
    return HandlerResult(answer="\n".join(lines), sources=sources)


def handle_query_plan(
    session: Session,
    repository_id: str,
    plan: dict | None,
) -> HandlerResult | None:
    if not plan:
        return None

    if not _is_allowed_plan(plan):
        return HandlerResult(answer="질문을 실행 가능한 DB 조회 계획으로 변환하지 못했습니다.", sources=[])

    if plan.get("answerable") is False:
        return HandlerResult(
            answer="현재 데모에서는 재고, 발주, 견적서, 발주서, 거래처 이력, 등록 문서 검색 관련 질문만 답변할 수 있습니다.",
            sources=[],
        )

    operation = plan.get("operation")
    if operation in {"required_orders", "deadline_required"}:
        return _execute_required_orders(session, repository_id, plan)
    if operation == "general_search":
        return None

    tables = _tables_from_plan(plan)
    if not tables:
        return None
    if len(tables) == 1:
        return _execute_single_table_plan(session, repository_id, plan, tables[0])
    return _execute_multi_table_plan(session, repository_id, plan, tables)
