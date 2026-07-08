import json
import re
from difflib import SequenceMatcher
from typing import Literal

from app.services.llm_service import chat_with_ollama


ChatIntent = Literal[
    "inventory_query",
    "partner_history_query",
    "business_document_query",
    "purchase_required_query",
    "quotation_create",
    "general_xlsx_search",
]

ALLOWED_INTENTS: set[str] = {
    "inventory_query",
    "partner_history_query",
    "business_document_query",
    "purchase_required_query",
    "quotation_create",
    "general_xlsx_search",
}

COMPANY_SUFFIXES = [
    "물산",
    "상사",
    "전자",
    "전장",
    "산업",
    "정밀",
    "테크",
    "파트너스",
    "코리아",
    "company",
    "co.",
    "corp",
]


def _looks_like_company_name(text: str) -> bool:
    # A short standalone company name should not fall through to semantic RAG.
    if not re.fullmatch(r"[가-힣A-Za-z0-9&().\s-]{2,30}", text):
        return False

    return any(suffix in text for suffix in COMPANY_SUFFIXES)


INTENT_EXAMPLES: dict[ChatIntent, list[str]] = {
    "inventory_query": [
        "근접센서 몇 개 남았어?",
        "이 품목 재고 있어?",
        "현재고 알려줘",
        "단가 얼마야?",
        "재고 수량 확인해줘",
    ],
    "partner_history_query": [
        "해안물산하고 거래한 적 있어?",
        "이 거래처랑 입출고 내역 있어?",
        "거래 내역 확인해줘",
    ],
    "business_document_query": [
        "해안물산 견적서 있어?",
        "발주서 찾아줘",
        "PO 번호로 발주서 조회해줘",
        "견적서 내용 보여줘",
    ],
    "purchase_required_query": [
        "내일까지 발주해야 하는 것이 있어?",
        "지금 발주해야 하는 품목 알려줘",
        "부족한 품목 뭐야?",
        "자동 발주 대상 있어?",
        "추가 발주 필요한 부품 있어?",
        "이번 주 안에 구매해야 하는 자재 있어?",
    ],
    "quotation_create": [
        "견적서 생성해줘",
        "견적서 만들어줘",
        "이 내용으로 견적서 작성해줘",
    ],
    "general_xlsx_search": [
        "문서 요약해줘",
        "파일에서 관련 내용 찾아줘",
    ],
}


def _normalize_for_similarity(text: str) -> str:
    return re.sub(r"[^가-힣a-z0-9]+", "", text.lower())


def classify_intent_by_similarity(message: str) -> tuple[ChatIntent | None, float]:
    # Demo utterances are small enough to compare with curated examples before
    # paying the cost of an LLM classifier.
    normalized_message = _normalize_for_similarity(message)
    if not normalized_message:
        return None, 0.0

    best_intent: ChatIntent | None = None
    best_score = 0.0

    for intent, examples in INTENT_EXAMPLES.items():
        for example in examples:
            score = SequenceMatcher(
                None,
                normalized_message,
                _normalize_for_similarity(example),
            ).ratio()
            if score > best_score:
                best_intent = intent
                best_score = score

    if best_intent and best_score >= 0.62:
        return best_intent, round(best_score, 3)

    return None, best_score


def classify_intent_rule(message: str) -> tuple[ChatIntent | None, float]:
    # Fast deterministic path for the fixed demo question categories.
    text = message.strip().lower()

    if any(k in text for k in ["견적서 생성", "견적서 만들어", "견적서 뽑아", "견적서 작성"]):
        return "quotation_create", 0.95

    purchase_required_keywords = [
        "발주해야",
        "발주 해야",
        "발주 필요",
        "필요 발주",
        "자동 발주",
        "추가 발주",
        "발주 대상",
        "주문해야",
        "구매해야",
        "사야",
        "구매 필요",
        "부족 품목",
        "부족한 품목",
        "부족한 자재",
        "내일까지 발주",
        "이번 주 안에",
    ]
    if "발주서" not in text and any(k in text for k in purchase_required_keywords):
        return "purchase_required_query", 0.93

    if any(k in text for k in ["재고", "몇 개", "몇개", "남았", "부족", "수량", "단가"]):
        return "inventory_query", 0.9

    if any(k in text for k in ["거래한 적", "거래 내역", "거래내역", "거래처", "입출고"]):
        return "partner_history_query", 0.9

    if any(k in text for k in ["견적서", "발주서"]) or re.search(r"\b(po|qt)-\d", text):
        return "business_document_query", 0.85

    if _looks_like_company_name(text):
        return "partner_history_query", 0.86

    return None, 0.0


def classify_intent_with_ollama(message: str) -> tuple[ChatIntent, float]:
    # Ollama is a fallback classifier only; it must return an allowed intent.
    prompt = f"""
다음 사용자 질문을 아래 intent 중 하나로만 분류하세요.

가능한 intent:
- inventory_query: 재고, 수량, 단가, 부족 여부 질문
- partner_history_query: 거래처, 거래 내역, 입출고 이력 질문
- business_document_query: 견적서/발주서 존재 여부, 내용 조회 질문
- purchase_required_query: 발주 필요 여부, 부족 품목, 자동/추가 발주 대상 질문
- quotation_create: 견적서 생성/작성 요청
- general_xlsx_search: 위에 해당하지 않는 일반 문서 검색 질문

반드시 JSON만 반환하세요.
형식:
{{"intent":"...", "confidence":0.0}}

사용자 질문:
{message}
""".strip()

    try:
        content = chat_with_ollama(
            [
                {
                    "role": "system",
                    "content": "You classify Korean user questions. Return JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
            timeout=60,
        )
        match = re.search(r"\{.*\}", content, flags=re.S)
        data = json.loads(match.group(0) if match else content)
        intent = data.get("intent")
        confidence = float(data.get("confidence", 0))
    except Exception:
        return "general_xlsx_search", 0.0

    if intent not in ALLOWED_INTENTS or confidence < 0.6:
        return "general_xlsx_search", confidence

    return intent, confidence


def classify_intent(message: str) -> tuple[ChatIntent, float, str]:
    intent, confidence = classify_intent_rule(message)
    if intent and confidence >= 0.85:
        return intent, confidence, "rule"

    similar_intent, similar_confidence = classify_intent_by_similarity(message)
    if similar_intent and similar_confidence >= 0.62:
        return similar_intent, similar_confidence, "similarity"

    # Ambiguous questions are classified by the local LLM, then validated.
    fallback_intent, fallback_confidence = classify_intent_with_ollama(message)
    return fallback_intent, fallback_confidence, "ollama"
