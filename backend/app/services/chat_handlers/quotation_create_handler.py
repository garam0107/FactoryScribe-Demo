from sqlmodel import Session

from app.services.chat_handlers.common import HandlerResult
from app.services.chat_handlers.entity_extractor import ExtractedEntities


def handle_quotation_create(
    session: Session,
    repository_id: str,
    message: str,
    entities: ExtractedEntities,
    conversation_id: str | None = None,
) -> HandlerResult:
    # Keep generation deterministic for the demo. The chat flow asks for the
    # structured fields instead of guessing a quotation from free text.
    answer = "\n".join(
        [
            "견적서를 생성하려면 아래 정보가 필요합니다.",
            "",
            "- 고객명",
            "- 프로젝트명",
            "- 견적일자",
            "- 품목명",
            "- 품목코드(선택)",
            "- 수량",
            "- 단가",
            "",
            "예: 해안물산 / 베트남 라인 증설 / 2026-07-08 / 근접센서 10개 단가 20,000원",
        ]
    )

    return HandlerResult(
        answer=answer,
        sources=[],
        action={
            "type": "quotation_create",
            "status": "needs_required_fields",
            "required_fields": [
                "customer_name",
                "project_name",
                "quotation_date",
                "items.item_name",
                "items.quantity",
                "items.unit_price",
            ],
        },
    )
