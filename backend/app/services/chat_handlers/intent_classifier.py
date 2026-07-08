import json
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Literal

import httpx

from app.config import settings
from app.services.llm_service import chat_with_ollama


ChatIntent = Literal[
    "inventory_query",
    "partner_history_query",
    "business_document_query",
    "purchase_required_query",
    "quotation_create",
    "general_xlsx_search",
    "unsupported",
]

ALLOWED_INTENTS: set[str] = {
    "inventory_query",
    "partner_history_query",
    "business_document_query",
    "purchase_required_query",
    "quotation_create",
    "general_xlsx_search",
    "unsupported",
}

ALLOWED_QUERY_TYPES: set[str] = {
    "item_lookup",
    "max_stock",
    "min_stock",
    "shortage_list",
    "price_lookup",
    "price_change",
    "inventory_summary",
    "partner_history",
    "quotation_lookup",
    "purchase_order_lookup",
    "document_list",
    "required_orders",
    "deadline_required",
    "auto_order",
    "additional_order",
    "create_quotation",
    "general",
    "unsupported",
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

INTENT_EXAMPLES: dict[ChatIntent, list[str]] = {
    "inventory_query": [
        "근접센서 몇 개 남았어?",
        "현재고 알려줘",
        "단가 얼마야?",
        "가장 많은 재고가 뭐야?",
        "가장 적은 재고가 뭐야?",
        "재고 요약해줘",
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
    "unsupported": [
        "오늘 날씨 어때?",
        "점심 뭐 먹을까?",
    ],
}


@dataclass
class IntentParseResult:
    intent: ChatIntent
    confidence: float
    source: str
    query_type: str | None = None
    item_name: str | None = None
    item_code: str | None = None
    partner_name: str | None = None
    quotation_no: str | None = None
    purchase_order_no: str | None = None
    date_condition: str | None = None
    wants_quotation: bool | None = None
    wants_purchase_order: bool | None = None
    query_plan: dict | None = None
    raw: dict = field(default_factory=dict)


def _openai_enabled() -> bool:
    return bool(getattr(settings, "openai_api_key", None))


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_for_similarity(text: str) -> str:
    return re.sub(r"[^가-힣a-z0-9]+", "", text.lower())


def _looks_like_company_name(text: str) -> bool:
    if not re.fullmatch(r"[가-힣A-Za-z0-9&().\s-]{2,30}", text):
        return False
    return any(suffix in text for suffix in COMPANY_SUFFIXES)


def _extract_partner_candidate(message: str) -> str | None:
    patterns = [
        r"([가-힣A-Za-z0-9&().\s-]{2,30})(?:하고|이랑|랑|와|과)\s*거래",
        r"([가-힣A-Za-z0-9&().\s-]{2,30})\s*거래처",
        r"([가-힣A-Za-z0-9&().\s-]{2,30})\s*(?:견적서|발주서)",
    ]
    for pattern in patterns:
        match = re.search(pattern, message)
        if not match:
            continue
        candidate = match.group(1).strip()
        for noise in ["아니", "내가", "혹시", "정말"]:
            candidate = candidate.replace(noise, "").strip()
        if candidate:
            return candidate
    return None


def _infer_intent_from_plan(plan: dict) -> ChatIntent:
    if plan.get("answerable") is False:
        return "unsupported"

    tables = plan.get("tables") or []
    table = plan.get("table")
    if table:
        tables.append(table)
    table_names = set(tables)
    operation = plan.get("operation")

    if operation in {"create_quotation"}:
        return "quotation_create"
    if operation in {"required_orders", "deadline_required", "auto_order", "additional_order"}:
        return "purchase_required_query"
    if "inventory_items" in table_names:
        return "inventory_query"
    if "transaction_records" in table_names:
        return "partner_history_query"
    if table_names & {
        "quotation_documents",
        "quotation_items",
        "purchase_order_documents",
        "purchase_order_items",
    }:
        return "business_document_query"
    if operation == "general_search":
        return "general_xlsx_search"

    return "general_xlsx_search"


def _infer_query_type_from_plan(plan: dict) -> str | None:
    if plan.get("answerable") is False:
        return "unsupported"

    operation = plan.get("operation")
    table = plan.get("table")
    tables = set(plan.get("tables") or [])
    if table:
        tables.add(table)

    if operation == "top_n" and "inventory_items" in tables:
        return "max_stock"
    if operation == "bottom_n" and "inventory_items" in tables:
        return "min_stock"
    if operation == "summary" and "inventory_items" in tables:
        return "inventory_summary"
    if operation in {"required_orders", "deadline_required", "auto_order", "additional_order"}:
        return operation
    if operation == "create_quotation":
        return "create_quotation"
    if "transaction_records" in tables:
        return "partner_history"
    if "quotation_documents" in tables or "quotation_items" in tables:
        return "quotation_lookup"
    if "purchase_order_documents" in tables or "purchase_order_items" in tables:
        return "purchase_order_lookup"

    return "general"


def _extract_entities_from_plan(plan: dict) -> dict:
    filters = plan.get("filters") if isinstance(plan.get("filters"), dict) else {}
    entities = plan.get("entities") if isinstance(plan.get("entities"), dict) else {}
    merged = {**filters, **entities}
    return merged


def _parse_query_plan_result(data: dict, source: str) -> IntentParseResult:
    plan = data.get("query_plan") if isinstance(data.get("query_plan"), dict) else data
    entities = _extract_entities_from_plan(plan)
    intent = _infer_intent_from_plan(plan)
    query_type = _infer_query_type_from_plan(plan)

    return IntentParseResult(
        intent=intent,
        confidence=max(0.0, min(_safe_float(data.get("confidence", plan.get("confidence")), 0.0), 1.0)),
        source=source,
        query_type=query_type,
        item_name=entities.get("item_name"),
        item_code=entities.get("item_code"),
        partner_name=entities.get("partner_name") or entities.get("recipient_company_name"),
        quotation_no=entities.get("quotation_no"),
        purchase_order_no=entities.get("purchase_order_no"),
        date_condition=entities.get("date_condition"),
        wants_quotation="quotation_documents" in (plan.get("tables") or []) or plan.get("table") == "quotation_documents",
        wants_purchase_order="purchase_order_documents" in (plan.get("tables") or [])
        or plan.get("table") == "purchase_order_documents",
        query_plan=plan,
        raw=data,
    )


def classify_with_openai_query_plan(message: str) -> IntentParseResult | None:
    if not _openai_enabled():
        return None

    system_prompt = """
You are the query planner for FactoryScribe, a Korean manufacturing document search and procurement demo.

The XLSX files have already been scanned, indexed, synced, and loaded into a structured SQLite database.
Your job is not to answer the user. Your job is to understand the Korean user question and return a safe query_plan JSON that the backend can validate and execute.

Never invent data. Never decide whether data exists. Never write SQL.
Choose only from the allowed tables, fields, and operations below.
If the question cannot be answered from these data types, return answerable=false.

Allowed tables and fields:
- inventory_items:
  id, item_code, item_name, category, spec, unit, supplier,
  current_stock, safety_stock, target_stock, avg_monthly_usage,
  previous_year_usage_quantity, current_remaining_quantity, current_year_expected_quantity,
  current_unit_price, previous_unit_price, price_change_rate,
  stock_status, expected_depletion_days, warehouse_location,
  source_filename, source_sheet_name, source_row
- transaction_records:
  id, transaction_date, transaction_no, item_code, item_name, transaction_type,
  quantity, unit_price, amount, partner_name, project_or_order_no,
  warehouse_location, manager_name, source_filename, source_sheet_name, source_row
- quotation_documents:
  id, quotation_no, quotation_date, recipient_company_name, issuer_company_name,
  project_name, delivery_terms, payment_terms, valid_until_text,
  source_filename, source_sheet_name
- quotation_items:
  id, quotation_document_id, item_code, item_name, spec, quantity,
  unit_price, supply_amount, tax_amount, total_amount, source_row
- purchase_order_documents:
  id, purchase_order_no, order_date, recipient_company_name, issuer_company_name,
  project_name, issuer_contact_name, issuer_contact_text, source_filename, source_sheet_name
- purchase_order_items:
  id, purchase_order_document_id, item_code, item_name, spec, unit,
  quantity, requested_delivery_date, unit_price, status_text, note, source_row

Allowed operations:
- find: find matching rows
- list: list matching rows
- exists: check whether matching data exists
- count: count matching rows
- sum: sum numeric field values
- top_n: largest values by sort.field
- bottom_n: smallest values by sort.field
- summary: summarize one table
- required_orders: items that likely need ordering
- deadline_required: ordering need with date condition
- general_search: use document search fallback

Return JSON only in this shape:
{
  "confidence": 0.0,
  "query_plan": {
    "answerable": true,
    "operation": "top_n",
    "table": "inventory_items",
    "tables": [],
    "filters": {},
    "sort": {"field": "current_remaining_quantity", "direction": "desc"},
    "limit": 1,
    "answer_fields": ["item_name", "item_code", "current_remaining_quantity", "source_filename", "source_sheet_name", "source_row"],
    "date_condition": null,
    "reason": null
  }
}

Guidance:
- For "가장 많은 재고", use inventory_items top_n by current_remaining_quantity desc.
- For "가장 적은 재고", use inventory_items bottom_n by current_remaining_quantity asc.
- For item inventory quantity, use inventory_items find with item_name or item_code.
- For partner/vendor history, search transaction_records, quotation_documents, and purchase_order_documents with partner/company filter.
- For quotation/purchase-order lookup, use quotation_documents/items or purchase_order_documents/items.
- For required ordering or shortage/order need, use operation required_orders or deadline_required.
- For document summary/search inside FactoryScribe documents, use general_search.
- For unrelated questions such as weather, food, coding, general knowledge, return answerable=false with reason "unsupported_question".
""".strip()

    payload = {
        "model": settings.openai_intent_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    try:
        response = httpx.post(
            f"{settings.openai_base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json=payload,
            timeout=settings.openai_intent_timeout,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
    except Exception:
        return None

    parsed = _parse_query_plan_result(data, source="openai")
    if parsed.confidence < 0.45:
        return None
    return parsed


def classify_intent_rule(message: str) -> IntentParseResult | None:
    text = message.strip().lower()
    compact = _normalize_for_similarity(text)

    if any(k in compact for k in ["가장많은재고", "제일많은재고", "많은재고", "최대재고"]):
        plan = {
            "answerable": True,
            "operation": "top_n",
            "table": "inventory_items",
            "filters": {},
            "sort": {"field": "current_remaining_quantity", "direction": "desc"},
            "limit": 1,
            "answer_fields": ["item_name", "item_code", "current_remaining_quantity"],
        }
        return _parse_query_plan_result({"confidence": 0.9, "query_plan": plan}, "rule")

    if any(k in compact for k in ["가장적은재고", "제일적은재고", "적은재고", "최소재고"]):
        plan = {
            "answerable": True,
            "operation": "bottom_n",
            "table": "inventory_items",
            "filters": {},
            "sort": {"field": "current_remaining_quantity", "direction": "asc"},
            "limit": 1,
            "answer_fields": ["item_name", "item_code", "current_remaining_quantity"],
        }
        return _parse_query_plan_result({"confidence": 0.9, "query_plan": plan}, "rule")

    if any(k in compact for k in ["재고요약", "재고현황", "전체재고"]):
        plan = {
            "answerable": True,
            "operation": "summary",
            "table": "inventory_items",
            "filters": {},
            "limit": 5,
        }
        return _parse_query_plan_result({"confidence": 0.86, "query_plan": plan}, "rule")

    if "발주서" not in text and any(k in text for k in ["발주해야", "발주 필요", "자동 발주", "추가 발주", "주문해야", "구매해야"]):
        operation = "deadline_required" if any(k in text for k in ["내일", "오늘", "이번 주"]) else "required_orders"
        plan = {"answerable": True, "operation": operation, "tables": ["inventory_items", "quotation_items", "purchase_order_items"], "filters": {}, "limit": 10}
        return _parse_query_plan_result({"confidence": 0.88, "query_plan": plan}, "rule")

    if any(k in text for k in ["거래한 적", "거래 내역", "거래내역", "거래처", "입출고"]):
        partner_name = _extract_partner_candidate(message)
        plan = {
            "answerable": True,
            "operation": "exists",
            "tables": ["transaction_records", "quotation_documents", "purchase_order_documents"],
            "filters": {"partner_name": partner_name} if partner_name else {},
            "limit": 10,
        }
        return _parse_query_plan_result({"confidence": 0.82, "query_plan": plan}, "rule")

    if any(k in text for k in ["견적서", "발주서"]) or re.search(r"\b(po|qt)-\d", text):
        partner_name = _extract_partner_candidate(message)
        tables = ["quotation_documents", "quotation_items"] if "견적서" in text else ["purchase_order_documents", "purchase_order_items"]
        plan = {
            "answerable": True,
            "operation": "find",
            "tables": tables,
            "filters": {"partner_name": partner_name} if partner_name else {},
            "limit": 10,
        }
        return _parse_query_plan_result({"confidence": 0.82, "query_plan": plan}, "rule")

    if _looks_like_company_name(text):
        plan = {
            "answerable": True,
            "operation": "exists",
            "tables": ["transaction_records", "quotation_documents", "purchase_order_documents"],
            "filters": {"partner_name": message.strip()},
            "limit": 10,
        }
        return _parse_query_plan_result({"confidence": 0.86, "query_plan": plan}, "rule")

    return None


def classify_intent_by_similarity(message: str) -> IntentParseResult | None:
    normalized_message = _normalize_for_similarity(message)
    if not normalized_message:
        return None

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

    if not best_intent or best_score < 0.62:
        return None

    if best_intent == "unsupported":
        plan = {"answerable": False, "operation": "unsupported", "reason": "unsupported_question"}
        return _parse_query_plan_result({"confidence": round(best_score, 3), "query_plan": plan}, "similarity")

    return IntentParseResult(best_intent, round(best_score, 3), "similarity")


def classify_with_ollama(message: str) -> IntentParseResult:
    prompt = f"""
다음 질문을 FactoryScribe 제조업 데모 DB query_plan JSON으로 변환하세요.
답변하지 말고 JSON만 반환하세요.

가능 operation: find, list, exists, count, sum, top_n, bottom_n, summary, required_orders, deadline_required, general_search
가능 table: inventory_items, transaction_records, quotation_documents, quotation_items, purchase_order_documents, purchase_order_items

질문: {message}
""".strip()

    try:
        content = chat_with_ollama(
            [
                {"role": "system", "content": "Return JSON only."},
                {"role": "user", "content": prompt},
            ],
            timeout=60,
        )
        match = re.search(r"\{.*\}", content, flags=re.S)
        data = json.loads(match.group(0) if match else content)
        return _parse_query_plan_result(data, source="ollama")
    except Exception:
        plan = {"answerable": True, "operation": "general_search", "filters": {}, "limit": 5}
        return _parse_query_plan_result({"confidence": 0.0, "query_plan": plan}, "ollama")


def classify_message(message: str) -> IntentParseResult:
    openai_result = classify_with_openai_query_plan(message)
    if openai_result:
        return openai_result

    rule_result = classify_intent_rule(message)
    if rule_result:
        return rule_result

    similarity_result = classify_intent_by_similarity(message)
    if similarity_result:
        return similarity_result

    return classify_with_ollama(message)


def classify_intent(message: str) -> tuple[ChatIntent, float, str]:
    parsed = classify_message(message)
    return parsed.intent, parsed.confidence, parsed.source
