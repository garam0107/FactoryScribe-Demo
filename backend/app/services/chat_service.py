from sqlmodel import Session

from app.models.conversation import Conversation
from app.models.message import Message, MessageSource
from app.schemas.common import success_response
from app.models.repository import DocumentRepository
from app.services.retrieval_service import retrieve_context
from app.services.llm_service import chat_with_ollama
from app.utils.ids import new_id
from app.utils.time import now_utc


SYSTEM_PROMPT = """
너는 FactoryScribe 제조 문서 검색 비서다.

규칙:
1. 반드시 제공된 검색 결과만 근거로 답변한다.
2. 검색 결과에 없는 내용은 추론하거나 생성하지 않는다.
3. 수량, 단가, 날짜, 품번은 검색 결과의 값을 그대로 사용한다.
4. 사용자가 재고 질문을 하면 현재고, 예약수량, 가용재고를 구분해서 답변한다.
5. 답변은 항상 자연스러운 한국어로 작성한다.
6. 불필요한 영어 단어를 섞지 않는다.
7. 검색 결과로 확인되지 않는 내용은 "검색 결과에서 확인되지 않습니다."라고 답변한다.
8. 답변 마지막에는 반드시 출처를 함께 제시한다.
"""

def _ensure_repository_exists(session: Session, repository_id: str) -> None:
    repo = session.get(DocumentRepository, repository_id)
    if not repo:
        raise ValueError("repository not found")


def build_citation(result: dict) -> str:
    citation = result.get("filename", "")

    if result.get("sheet_name"):
        citation += f" / {result.get('sheet_name')}"

    row_start = result.get("row_start")
    row_end = result.get("row_end")
    if row_start and row_end and row_end != row_start:
        citation += f" / Row {row_start}-{row_end}"
    elif row_start:
        citation += f" / Row {row_start}"

    if result.get("page_number"):
        citation += f" / Page {result.get('page_number')}"

    return citation
def build_context_text(results: list[dict]) -> str:
    blocks = []

    for i, result in enumerate(results, start=1):
        blocks.append(
            f"[검색결과 {i}]\n"
            f"출처: {build_citation(result)}\n"
            f"내용: {result.get('text')}"
        )

    return "\n\n".join(blocks)

def search_documents(session: Session, repository_id: str, query: str, limit: int = 5) -> list[dict]:
    _ensure_repository_exists(session, repository_id)

    results = retrieve_context(query, repository_id, limit=limit)

    formatted = []
    for i, result in enumerate(results, start=1):
        formatted.append({
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
        })

    return formatted
def ask_question(session: Session, repository_id: str, message: str, conversation_id: str | None = None):
    _ensure_repository_exists(session, repository_id)
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
            "content": f"""사용자 질문:
{message}

검색 결과:
{context_text}

위 검색 결과만 근거로 답변하세요.""",
        },
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
    for result in results:
        citation = build_citation(result)
        doc_id = result.get("document_id")

        source_row = MessageSource(
            id=new_id("src"),
            message_id=assistant_msg.id,
            document_id=doc_id,
            chunk_id=result.get("id"),
            score=result.get("_distance"),
            citation_text=citation,
            created_at=now_utc(),
        )
        session.add(source_row)

        sources.append({
            "document_id": doc_id,
            "chunk_id": result.get("id"),
            "filename": result.get("filename"),
            "citation": citation,
            "score": result.get("_distance"),
            "text": result.get("text"),
        })

    conv.updated_at = now_utc()
    session.commit()

    return success_response(
        {
            "conversation_id": conv.id,
            "answer": answer,
            "sources": sources,
        },
        message="답변을 생성했습니다.",
    )
