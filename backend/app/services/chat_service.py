import re

from sqlmodel import Session, select

from app.models.conversation import Conversation
from app.models.message import Message, MessageSource
from app.models.repository import DocumentRepository
from app.schemas.common import success_response
from app.services.chat_handlers.business_document_handler import (
    handle_business_document_query,
)
from app.services.chat_handlers.entity_extractor import extract_entities
from app.services.chat_handlers.general_rag_handler import build_citation, handle_general_rag_query
from app.services.chat_handlers.intent_classifier import classify_intent
from app.services.chat_handlers.inventory_handler import handle_inventory_query
from app.services.chat_handlers.partner_history_handler import handle_partner_history_query
from app.services.chat_handlers.purchase_required_handler import handle_purchase_required_query
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


def _run_intent_handler(
    session: Session,
    repository_id: str,
    message: str,
    conversation_id: str,
    intent: str,
):
    # Business-critical demo questions are answered from structured SQLite rows.
    # LanceDB/Ollama is only used by the general fallback handler.
    entities = extract_entities(session, repository_id, message)
    _add_standalone_partner_entity(intent, message, entities)

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
    else:
        intent, intent_confidence, intent_source = classify_intent(message)
    handler_result, entities = _run_intent_handler(
        session=session,
        repository_id=repository_id,
        message=message,
        conversation_id=conv.id,
        intent=intent,
    )

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
            "extracted_entities": entities.to_dict(),
            "action": handler_result.action,
        },
        message="답변을 생성했습니다.",
    )
