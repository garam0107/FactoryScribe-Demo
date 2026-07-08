import re

from sqlmodel import Session, select

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


def _remaining_quantity(item: InventoryItem) -> float:
    if item.current_remaining_quantity is not None:
        return item.current_remaining_quantity
    return item.current_stock


def _shortage_quantity(item: InventoryItem) -> float:
    remaining = _remaining_quantity(item)
    if item.target_stock is not None:
        return max(item.target_stock - remaining, 0)
    if item.safety_stock is not None:
        return max(item.safety_stock - remaining, 0)
    return 0


def _is_shortage_item(item: InventoryItem) -> bool:
    if _shortage_quantity(item) > 0:
        return True
    return bool(item.stock_status and "부족" in item.stock_status)


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
        r"뭐야",
        r"무엇",
        r"가장",
        r"제일",
        r"많은",
        r"적은",
        r"[?!.]",
    ]
    for pattern in remove_patterns:
        candidate = re.sub(pattern, " ", candidate, flags=re.I)

    candidate = re.sub(r"\s+", " ", candidate).strip()
    candidate = re.sub(r"^[은는이가을를의\s]+|[은는이가을를의\s]+$", "", candidate)

    if len(candidate) < 2:
        return None

    return candidate


def _inventory_source(item: InventoryItem) -> dict:
    remaining = _remaining_quantity(item)
    citation = row_citation(item.source_filename, item.source_sheet_name, item.source_row)
    return source_dict(
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


def _item_line(item: InventoryItem) -> str:
    remaining = _remaining_quantity(item)
    shortage_text = "부족" if _is_shortage_item(item) else "정상"
    unit = item.unit or "개"
    return (
        f"- {item.item_name}({item.item_code}): "
        f"현재고 {format_number(item.current_stock)}{unit}, "
        f"잔여수량 {format_number(remaining)}{unit}, "
        f"단가 {format_number(item.current_unit_price)}원, "
        f"상태 {shortage_text}"
    )


def _handle_ranked_stock(items: list[InventoryItem], query_type: str) -> HandlerResult:
    if not items:
        return HandlerResult(answer="현재 등록된 재고 데이터가 없습니다.", sources=[])

    reverse = query_type == "max_stock"
    ranked_items = sorted(items, key=_remaining_quantity, reverse=reverse)
    selected = ranked_items[0]
    label = "가장 많은" if reverse else "가장 적은"
    unit = selected.unit or "개"
    remaining = _remaining_quantity(selected)
    source = _inventory_source(selected)

    answer = (
        f"현재 등록된 재고 데이터 기준으로 {label} 재고는 "
        f"{selected.item_name}({selected.item_code})입니다.\n"
        f"잔여수량은 {format_number(remaining)}{unit}입니다.\n\n"
        f"출처:\n- {source['citation']}"
    )
    return HandlerResult(answer=answer, sources=[source])


def _handle_shortage_list(items: list[InventoryItem]) -> HandlerResult:
    shortage_items = [item for item in items if _is_shortage_item(item)]
    shortage_items.sort(key=_shortage_quantity, reverse=True)

    if not shortage_items:
        return HandlerResult(
            answer="현재 등록된 재고 데이터 기준으로 부족 품목은 확인되지 않습니다.",
            sources=[],
        )

    sources = [_inventory_source(item) for item in shortage_items[:10]]
    lines = [f"현재 등록된 재고 데이터 기준 부족 품목은 {len(shortage_items)}건입니다."]
    for item in shortage_items[:10]:
        unit = item.unit or "개"
        lines.append(
            "- "
            f"{item.item_name}({item.item_code}): "
            f"부족 {format_number(_shortage_quantity(item))}{unit}, "
            f"잔여 {format_number(_remaining_quantity(item))}{unit}"
        )

    lines.append("")
    lines.append("출처:")
    lines.extend(f"- {source['citation']}" for source in sources)
    return HandlerResult(answer="\n".join(lines), sources=sources)


def _handle_inventory_summary(items: list[InventoryItem]) -> HandlerResult:
    if not items:
        return HandlerResult(answer="현재 등록된 재고 데이터가 없습니다.", sources=[])

    shortage_count = sum(1 for item in items if _is_shortage_item(item))
    total_stock = sum(item.current_stock for item in items)
    total_remaining = sum(_remaining_quantity(item) for item in items)
    max_item = max(items, key=_remaining_quantity)
    min_item = min(items, key=_remaining_quantity)
    sources = [_inventory_source(max_item), _inventory_source(min_item)]

    answer = (
        "현재 등록된 재고 요약입니다.\n"
        f"- 전체 품목 수: {format_number(len(items))}건\n"
        f"- 현재고 합계: {format_number(total_stock)}\n"
        f"- 잔여수량 합계: {format_number(total_remaining)}\n"
        f"- 부족 품목 수: {format_number(shortage_count)}건\n"
        f"- 가장 많은 재고: {max_item.item_name}({format_number(_remaining_quantity(max_item))})\n"
        f"- 가장 적은 재고: {min_item.item_name}({format_number(_remaining_quantity(min_item))})\n\n"
        "출처:\n"
        + "\n".join(f"- {source['citation']}" for source in sources)
    )
    return HandlerResult(answer=answer, sources=sources)


def handle_inventory_query(
    session: Session,
    repository_id: str,
    message: str,
    entities: ExtractedEntities,
) -> HandlerResult:
    # Inventory answers are computed from SQLite rows. The LLM can classify the
    # query_type, but it never invents inventory values.
    _ensure_inventory_loaded(session, repository_id)

    items = session.exec(
        select(InventoryItem)
        .where(InventoryItem.repository_id == repository_id)
        .order_by(InventoryItem.item_name.asc())
    ).all()

    if entities.query_type == "max_stock":
        return _handle_ranked_stock(items, "max_stock")
    if entities.query_type == "min_stock":
        return _handle_ranked_stock(items, "min_stock")
    if entities.query_type == "shortage_list":
        return _handle_shortage_list(items)
    if entities.query_type == "inventory_summary":
        return _handle_inventory_summary(items)

    matched_items = [item for item in items if _matches_item(item, entities, message)]

    if not matched_items:
        requested_item = entities.item_names[0] if entities.item_names else None
        if not requested_item:
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
        lines.append(_item_line(item))
        sources.append(_inventory_source(item))

    lines.append("")
    lines.append("출처:")
    lines.extend(f"- {source['citation']}" for source in sources)

    return HandlerResult(answer="\n".join(lines), sources=sources)
