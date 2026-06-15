from sqlmodel import Session

from app.models.conversation import Conversation
from app.models.message import Message, MessageSource
from app.models.document import Document
from app.services.retrieval_service import retrieve_context
from app.services.llm_service import chat_with_ollama
from app.utils.ids import new_id
from app.utils.time import now_utc


SYSTEM_PROMPT = """
너는 FactoryScribe 제조 문서 검색 비서다.

규칙:
1. 반드시 제공된 검색 결과만 근거로 답변한다.
2. 검색 결과에 없는 내용은 추측하지 않는다.
3. 사용자가 재고, 수량, 몇 개, 남았는지 물으면 PDF/DOCX보다 XLSX의 현재고/재고수량/가용재고 값을 우선한다.
4. 권장재고, 안전재고, 표준 생산 로트, 최소주문수량은 현재 남은 수량으로 답하지 않는다.
5. 수량, 단가, 날짜, 품번은 검색 결과의 값을 그대로 인용한다.
6. 답변 마지막에는 출처를 표시한다.
"""


def build_context_text(results: list[dict]) -> str:
    blocks = []

    for i, r in enumerate(results, start=1):
        source = f"{r.get('filename')}"

        if r.get("sheet_name"):
            source += f" / Sheet: {r.get('sheet_name')}"

        if r.get("row_start"):
            source += f" / Row: {r.get('row_start')}"

        if r.get("page_number"):
            source += f" / Page: {r.get('page_number')}"

        blocks.append(
            f"[검색결과 {i}]\n"
            f"출처: {source}\n"
            f"내용: {r.get('text')}"
        )

    return "\n\n".join(blocks)


def ask_question(session: Session, repository_id: str, message: str, conversation_id: str | None = None):
    now = now_utc()

    if conversation_id:
        conv = session.get(Conversation, conversation_id)
        if not conv:
            raise ValueError("conversation not found")
    else:
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

    user_msg = Message(
        id=new_id("msg"),
        conversation_id=conv.id,
        role="user",
        content=message,
        created_at=now,
    )
    session.add(user_msg)

    results = retrieve_context(message, repository_id, limit=5)
    context_text = build_context_text(results)

    llm_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"""
사용자 질문:
{message}

검색 결과:
{context_text}

위 검색 결과만 근거로 답변해.
"""
        }
    ]

    answer = chat_with_ollama(llm_messages)

    assistant_msg = Message(
        id=new_id("msg"),
        conversation_id=conv.id,
        role="assistant",
        content=answer,
        created_at=now_utc(),
    )
    session.add(assistant_msg)

    sources = []

    for r in results:
        citation = r.get("filename", "")

        if r.get("sheet_name"):
            citation += f" / Sheet: {r.get('sheet_name')}"

        if r.get("row_start"):
            citation += f" / Row: {r.get('row_start')}"

        if r.get("page_number"):
            citation += f" / Page: {r.get('page_number')}"

        doc_id = r.get("document_id")

        source_row = MessageSource(
            id=new_id("src"),
            message_id=assistant_msg.id,
            document_id=doc_id,
            chunk_id=r.get("id"),
            score=r.get("_distance"),
            citation_text=citation,
            created_at=now_utc(),
        )
        session.add(source_row)

        sources.append({
            "document_id": doc_id,
            "chunk_id": r.get("id"),
            "filename": r.get("filename"),
            "citation": citation,
            "score": r.get("_distance"),
            "text": r.get("text"),
        })

    conv.updated_at = now_utc()
    session.commit()

    return {
        "conversation_id": conv.id,
        "answer": answer,
        "sources": sources,
    }