from sqlmodel import Session, select
import re

from app.models.inventory_item import InventoryItem
from app.services.chat_handlers.common import (
    HandlerResult,
    format_number,
    row_citation,
    source_dict,
)
from app.services.chat_handlers.entity_extractor import ExtractedEntities
from app.services.inventory_service import sync_inventory_items


def _ensure_inventory_loaded(session: Session, repository_id: str) -> None:
    exists = session.exec(
        select(InventoryItem.id).where(InventoryItem.repository_id == repository_id)
    ).first()
    if exists:
        return

    try:
        sync_inventory_items(session, repository_id)
    except ValueError:
        return


def _matches_item(item: InventoryItem, entities: ExtractedEntities, message: str) -> bool:
    if item.item_name in entities.item_names or item.item_code in entities.item_codes:
        return True

    text = message.lower()
    return item.item_name.lower() in text or item.item_code.lower() in text


def _extract_requested_item_candidate(message: str) -> str | None:
    candidate = message.strip()
    remove_patterns = [
        r"재고",
        r"현재고",
        r"수량",
        r"몇\s*개",
        r"남았\w*",
        r"있\w*",
        r"없\w*",
        r"부족\w*",
        r"단가",
        r"가격",
        r"확인\w*",
        r"알려\w*",
        r"얼마\w*",
        r"[?!.]",
    ]
    for pattern in remove_patterns:
        candidate = re.sub(pattern, " ", candidate, flags=re.I)

    candidate = re.sub(r"\s+", " ", candidate).strip()
    candidate = re.sub(r"^[은는이가을를의\s]+|[은는이가을를의\s]+$", "", candidate)

    if len(candidate) < 2:
        return None

    return candidate


def handle_inventory_query(
    session: Session,
    repository_id: str,
    message: str,
    entities: ExtractedEntities,
) -> HandlerResult:
    # Inventory answers must be value-preserving: no LLM inference or estimation.
    _ensure_inventory_loaded(session, repository_id)

    items = session.exec(
        select(InventoryItem)
        .where(InventoryItem.repository_id == repository_id)
        .order_by(InventoryItem.item_name.asc())
    ).all()
    matched_items = [item for item in items if _matches_item(item, entities, message)]

    if not matched_items:
        requested_item = _extract_requested_item_candidate(message)
        if requested_item:
            return HandlerResult(
                answer=f"현재 등록된 재고 데이터에서 '{requested_item}'은 확인되지 않습니다.",
                sources=[],
            )

        return HandlerResult(
            answer="어떤 품목의 재고를 확인할지 품목명이나 품목코드를 알려주세요.",
            sources=[],
        )

    lines = ["확인된 재고 정보입니다."]
    sources: list[dict] = []

    for item in matched_items[:5]:
        remaining = item.current_remaining_quantity
        if remaining is None:
            remaining = item.current_stock

        shortage_text = "부족" if item.target_stock is not None and item.current_stock < item.target_stock else "정상"
        unit = item.unit or "개"
        lines.append(
            "- "
            f"{item.item_name}"
            f"({item.item_code}): 현재고 {format_number(item.current_stock)}{unit}, "
            f"잔여수량 {format_number(remaining)}{unit}, "
            f"단가 {format_number(item.current_unit_price)}원, "
            f"상태 {shortage_text}"
        )

        citation = row_citation(item.source_filename, item.source_sheet_name, item.source_row)
        sources.append(
            source_dict(
                source_type="inventory",
                filename=item.source_filename,
                row=item.source_row,
                citation=citation,
                text=(
                    f"품목명={item.item_name}, 품목코드={item.item_code}, "
                    f"현재고={item.current_stock}, 잔여수량={remaining}, "
                    f"단가={item.current_unit_price}, 공급사={item.supplier}"
                ),
            )
        )

    lines.append("")
    lines.append("출처:")
    lines.extend(f"- {source['citation']}" for source in sources)

    return HandlerResult(answer="\n".join(lines), sources=sources)
