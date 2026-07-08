import json

import httpx

from app.config import settings
from app.services.chat_handlers.common import HandlerResult


def _openai_answer_enabled() -> bool:
    return bool(
        settings.openai_generate_answers
        and getattr(settings, "openai_api_key", None)
        and getattr(settings, "openai_answer_model", None)
    )


def _compact_sources(sources: list[dict]) -> list[dict]:
    compacted = []
    for source in sources[:12]:
        compacted.append(
            {
                "citation": source.get("citation"),
                "source_type": source.get("source_type"),
                "filename": source.get("filename"),
                "row": source.get("row"),
                "text": source.get("text"),
            }
        )
    return compacted


def _ensure_source_footer(answer: str, sources: list[dict]) -> str:
    if not sources or "출처" in answer:
        return answer.strip()

    citations = [source.get("citation") for source in sources if source.get("citation")]
    if not citations:
        return answer.strip()

    unique_citations = list(dict.fromkeys(citations))
    return answer.strip() + "\n\n출처: " + ", ".join(unique_citations[:3])


def generate_answer_from_facts(
    *,
    question: str,
    query_plan: dict | None,
    result: HandlerResult,
) -> str | None:
    if not _openai_answer_enabled():
        return None

    payload_data = {
        "question": question,
        "query_plan": query_plan,
        "backend_answer": result.answer,
        "query_result_sources": _compact_sources(result.sources),
        "has_sources": bool(result.sources),
    }

    system_prompt = """
너는 FactoryScribe의 제조업 데이터 답변 작성기다.

규칙:
1. 반드시 제공된 backend_answer, query_result_sources, query_plan 안의 정보만 사용한다.
2. 제공되지 않은 품목, 수량, 단가, 날짜, 거래처, 문서번호는 절대 추가하지 않는다.
3. query_result_sources가 비어 있고 backend_answer가 확인 불가라면 확인되지 않는다고만 답한다.
4. 답변은 한국어로 짧게 작성한다. 기본 1~3문장으로 답한다.
5. 사용자가 물어본 핵심 값만 답한다. 불필요한 설명, 추론, 추천은 하지 않는다.
6. 마지막에는 출처를 붙인다. 출처가 없으면 출처를 만들지 않는다.
7. 숫자와 단위는 제공된 값 그대로 사용한다. 백분율 값은 이미 %인지 확실하지 않으면 값을 바꾸지 않는다.
8. JSON을 반환하지 말고 최종 답변 문장만 반환한다.
""".strip()

    request_payload = {
        "model": settings.openai_answer_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": json.dumps(payload_data, ensure_ascii=False, default=str),
            },
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    try:
        response = httpx.post(
            f"{settings.openai_base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json=request_payload,
            timeout=settings.openai_answer_timeout,
        )
        response.raise_for_status()
        answer = response.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return None

    if not answer:
        return None

    return _ensure_source_footer(answer, result.sources)
