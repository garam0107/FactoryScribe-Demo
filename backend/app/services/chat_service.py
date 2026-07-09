import re

from sqlmodel import Session, select

from app.models.conversation import Conversation
from app.models.message import Message, MessageSource
from app.models.repository import DocumentRepository
from app.schemas.common import success_response
from app.services.chat_answer_service import generate_answer_from_facts
from app.services.chat_handlers.business_document_handler import (
    handle_business_document_query,
)
from app.services.chat_handlers.entity_extractor import extract_entities
from app.services.chat_handlers.general_rag_handler import build_citation, handle_general_rag_query
from app.services.chat_handlers.intent_classifier import IntentParseResult, classify_message
from app.services.chat_handlers.inventory_handler import handle_inventory_query
from app.services.chat_handlers.partner_history_handler import handle_partner_history_query
from app.services.chat_handlers.purchase_required_handler import handle_purchase_required_query
from app.services.chat_handlers.query_plan_handler import handle_query_plan
from app.services.chat_handlers.quotation_create_handler import handle_quotation_create
from app.services.retrieval_service import retrieve_context
from app.utils.ids import new_id
from app.utils.time import now_utc


def _ensure_repository_exists(session: Session, repository_id: str) -> None:
    repo = session.get(DocumentRepository, repository_id)
    if not repo:
        raise ValueError("repository not found")


def search_documents(
    session: Session,
    repository_id: str,
    query: str,
    limit: int = 5,
) -> list[dict]:
    # Keep /chat/search-test as a raw RAG inspection endpoint.
    _ensure_repository_exists(session, repository_id)

    results = retrieve_context(query, repository_id, limit=limit)

    formatted = []
    for i, result in enumerate(results, start=1):
        formatted.append(
            {
                "rank": i,
                "document_id": result.get("document_id"),
                "chunk_id": result.get("id"),
                "filename": result.get("filename"),
                "file_ext": result.get("file_ext"),
                "source_type": result.get("source_type"),
                "sheet_name": result.get("sheet_name"),
                "row_start": result.get("row_start"),
                "row_end": result.get("row_end"),
                "page_number": result.get("page_number"),
                "score": result.get("_distance"),
                "citation": build_citation(result),
                "text": result.get("text"),
            }
        )

    return formatted


def list_conversations(session: Session, repository_id: str) -> list[dict]:
    _ensure_repository_exists(session, repository_id)

    conversations = session.exec(
        select(Conversation)
        .where(Conversation.repository_id == repository_id)
        .order_by(Conversation.updated_at.desc())
    ).all()

    return [
        {
            "id": conversation.id,
            "repository_id": conversation.repository_id,
            "title": conversation.title or "새 대화",
            "created_at": conversation.created_at.isoformat(),
            "updated_at": conversation.updated_at.isoformat(),
        }
        for conversation in conversations
    ]


def get_conversation_messages(
    session: Session,
    repository_id: str,
    conversation_id: str,
) -> list[dict]:
    _ensure_repository_exists(session, repository_id)

    conversation = session.get(Conversation, conversation_id)
    if not conversation or conversation.repository_id != repository_id:
        raise ValueError("conversation not found")

    messages = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    ).all()

    return [
        {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "role": message.role,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
        }
        for message in messages
    ]


def _get_or_create_conversation(
    session: Session,
    repository_id: str,
    message: str,
    conversation_id: str | None,
) -> Conversation:
    now = now_utc()

    if conversation_id:
        conv = session.get(Conversation, conversation_id)
        if not conv:
            raise ValueError("conversation not found")
        return conv

    conv = Conversation(
        id=new_id("conv"),
        repository_id=repository_id,
        title=message[:30],
        created_at=now,
        updated_at=now,
    )
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return conv


def _looks_like_short_entity(message: str) -> bool:
    cleaned = message.strip().strip("?!., ")
    return bool(re.fullmatch(r"[가-힣A-Za-z0-9&().\s-]{2,30}", cleaned))


def _infer_followup_intent(
    session: Session,
    conversation_id: str,
    message: str,
) -> tuple[str, float, str] | None:
    # If the assistant asked for a missing 거래처명, a short next message is
    # treated as that partner name instead of being sent to generic RAG.
    if not _looks_like_short_entity(message):
        return None

    recent_messages = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(8)
    ).all()

    for recent in recent_messages:
        content = recent.content or ""
        if recent.role == "assistant" and "거래처명" in content and "알려" in content:
            return "partner_history_query", 0.95, "conversation"
        if recent.role == "user" and any(
            keyword in content
            for keyword in ["거래한 적", "거래 내역", "거래내역", "거래처", "입출고"]
        ):
            return "partner_history_query", 0.9, "conversation"

    return None


def _add_standalone_partner_entity(intent: str, message: str, entities) -> None:
    # A standalone company name like "현진물산" may not exist in the candidate
    # tables yet. For partner-history intent, use it as the lookup key directly.
    if intent != "partner_history_query" or entities.partner_names:
        return

    cleaned = message.strip().strip("?!., ")
    if _looks_like_short_entity(cleaned):
        entities.partner_names.append(cleaned)


def _merge_classifier_result(entities, parsed: IntentParseResult) -> None:
    entities.query_type = parsed.query_type
    entities.date_condition = parsed.date_condition

    if parsed.item_name and parsed.item_name not in entities.item_names:
        entities.item_names.append(parsed.item_name)
    if parsed.item_code and parsed.item_code not in entities.item_codes:
        entities.item_codes.append(parsed.item_code)
    if parsed.partner_name and parsed.partner_name not in entities.partner_names:
        entities.partner_names.append(parsed.partner_name)
    if parsed.quotation_no:
        entities.quotation_no = parsed.quotation_no
    if parsed.purchase_order_no:
        entities.purchase_order_no = parsed.purchase_order_no
    if parsed.wants_quotation is not None:
        entities.wants_quotation = parsed.wants_quotation
    if parsed.wants_purchase_order is not None:
        entities.wants_purchase_order = parsed.wants_purchase_order


def _query_plan_with_entities(plan: dict, entities) -> dict:
    merged_plan = dict(plan)
    filters = dict(merged_plan.get("filters") or {})
    tables = set(merged_plan.get("tables") or [])
    table = merged_plan.get("table")
    if table:
        tables.add(table)

    if entities.partner_names and not any(
        key in filters for key in ["partner_name", "recipient_company_name", "issuer_company_name"]
    ):
        if tables & {"transaction_records", "quotation_documents", "purchase_order_documents"}:
            filters["partner_name"] = entities.partner_names[0]

    if entities.item_names and "item_name" not in filters:
        if tables & {"inventory_items", "transaction_records", "quotation_items", "purchase_order_items"}:
            filters["item_name"] = entities.item_names[0]

    if entities.item_codes and "item_code" not in filters:
        if tables & {"inventory_items", "transaction_records", "quotation_items", "purchase_order_items"}:
            filters["item_code"] = entities.item_codes[0]

    if entities.quotation_no and "quotation_no" not in filters:
        if "quotation_documents" in tables:
            filters["quotation_no"] = entities.quotation_no

    if entities.purchase_order_no and "purchase_order_no" not in filters:
        if "purchase_order_documents" in tables:
            filters["purchase_order_no"] = entities.purchase_order_no

    merged_plan["filters"] = filters
    return merged_plan


def _run_intent_handler(
    session: Session,
    repository_id: str,
    message: str,
    conversation_id: str,
    intent: str,
    parsed_intent: IntentParseResult | None = None,
):
    # Business-critical demo questions are answered from structured SQLite rows.
    # LanceDB/Ollama is only used by the general fallback handler.
    entities = extract_entities(session, repository_id, message)
    if parsed_intent:
        _merge_classifier_result(entities, parsed_intent)
    _add_standalone_partner_entity(intent, message, entities)

    if intent == "unsupported":
        return (
            handle_query_plan(
                session=session,
                repository_id=repository_id,
                plan={"answerable": False, "operation": "unsupported", "reason": "unsupported_question"},
            ),
            entities,
        )

    if parsed_intent and parsed_intent.query_plan:
        executable_plan = _query_plan_with_entities(parsed_intent.query_plan, entities)
        parsed_intent.query_plan = executable_plan
        query_plan_result = handle_query_plan(
            session=session,
            repository_id=repository_id,
            plan=executable_plan,
        )
        if query_plan_result is not None:
            return query_plan_result, entities

    if intent == "inventory_query":
        result = handle_inventory_query(session, repository_id, message, entities)
    elif intent == "partner_history_query":
        result = handle_partner_history_query(session, repository_id, message, entities)
    elif intent == "business_document_query":
        result = handle_business_document_query(session, repository_id, message, entities)
    elif intent == "purchase_required_query":
        result = handle_purchase_required_query(session, repository_id, message)
    elif intent == "quotation_create":
        result = handle_quotation_create(
            session,
            repository_id,
            message,
            entities,
            conversation_id=conversation_id,
        )
    else:
        result = handle_general_rag_query(session, repository_id, message)

    return result, entities


def _save_sources(session: Session, message_id: str, sources: list[dict]) -> None:
    for source in sources:
        # Structured sources may not map to document_chunks, but message_sources
        # requires document_id. Store an empty id and return rich source data in API.
        session.add(
            MessageSource(
                id=new_id("src"),
                message_id=message_id,
                document_id=source.get("document_id") or "",
                chunk_id=source.get("chunk_id"),
                score=source.get("score"),
                citation_text=source.get("citation"),
                created_at=now_utc(),
            )
        )


def ask_question(
    session: Session,
    repository_id: str,
    message: str,
    conversation_id: str | None = None,
):
    _ensure_repository_exists(session, repository_id)

    conv = _get_or_create_conversation(
        session=session,
        repository_id=repository_id,
        message=message,
        conversation_id=conversation_id,
    )

    session.add(
        Message(
            id=new_id("msg"),
            conversation_id=conv.id,
            role="user",
            content=message,
            created_at=now_utc(),
        )
    )

    followup_intent = _infer_followup_intent(session, conv.id, message)
    if followup_intent:
        intent, intent_confidence, intent_source = followup_intent
        parsed_intent = IntentParseResult(
            intent=intent,
            confidence=intent_confidence,
            source=intent_source,
            query_type="partner_history" if intent == "partner_history_query" else None,
        )
    else:
        parsed_intent = classify_message(message)
        intent = parsed_intent.intent
        intent_confidence = parsed_intent.confidence
        intent_source = parsed_intent.source
    handler_result, entities = _run_intent_handler(
        session=session,
        repository_id=repository_id,
        message=message,
        conversation_id=conv.id,
        intent=intent,
        parsed_intent=parsed_intent,
    )
    generated_answer = generate_answer_from_facts(
        question=message,
        query_plan=parsed_intent.query_plan if parsed_intent else None,
        result=handler_result,
    )
    answer_source = "openai_facts" if generated_answer else "backend_template"
    if generated_answer:
        handler_result.answer = generated_answer

    assistant_msg = Message(
        id=new_id("msg"),
        conversation_id=conv.id,
        role="assistant",
        content=handler_result.answer,
        created_at=now_utc(),
    )
    session.add(assistant_msg)
    _save_sources(session, assistant_msg.id, handler_result.sources)

    conv.updated_at = now_utc()
    session.commit()

    return success_response(
        {
            "conversation_id": conv.id,
            "answer": handler_result.answer,
            "sources": handler_result.sources,
            "intent": intent,
            "intent_confidence": intent_confidence,
            "intent_source": intent_source,
            "query_type": entities.query_type,
            "query_plan": parsed_intent.query_plan if parsed_intent else None,
            "answer_source": answer_source,
            "extracted_entities": entities.to_dict(),
            "action": handler_result.action,
        },
        message="답변을 생성했습니다.",
    )
