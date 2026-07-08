from sqlmodel import Session

from app.services.chat_handlers.common import HandlerResult
from app.services.llm_service import chat_with_ollama
from app.services.retrieval_service import retrieve_context


SYSTEM_PROMPT = """
당신은 FactoryScribe 제조업 문서 검색 비서입니다.

규칙:
1. 반드시 제공된 검색 결과만 근거로 답변하세요.
2. 검색 결과에 없는 내용은 추론하거나 생성하지 마세요.
3. 수량, 단가, 날짜, 문서번호는 검색 결과의 값을 그대로 사용하세요.
4. 검색 결과로 확인되지 않는 내용은 "검색 결과에서 확인되지 않습니다."라고 답변하세요.
5. 답변은 자연스러운 한국어로 작성하세요.
6. 답변 마지막에는 반드시 출처를 함께 표시하세요.
""".strip()


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
            f"[검색 결과 {i}]\n"
            f"출처: {build_citation(result)}\n"
            f"내용: {result.get('text')}"
        )

    return "\n\n".join(blocks)


def handle_general_rag_query(
    session: Session,
    repository_id: str,
    message: str,
) -> HandlerResult:
    # Fallback only: structured handlers own inventory, partner, document, and action queries.
    results = retrieve_context(message, repository_id, limit=5)

    if not results:
        return HandlerResult(
            answer="현재 등록된 문서에서 관련 내용을 확인하지 못했습니다.",
            sources=[],
        )

    context_text = build_context_text(results)
    answer = chat_with_ollama(
        [
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
    )

    sources = []
    for result in results:
        sources.append(
            {
                "document_id": result.get("document_id"),
                "chunk_id": result.get("id"),
                "filename": result.get("filename"),
                "citation": build_citation(result),
                "score": result.get("_distance"),
                "source_type": result.get("source_type"),
                "row": result.get("row_start"),
                "text": result.get("text"),
            }
        )

    return HandlerResult(answer=answer, sources=sources)
