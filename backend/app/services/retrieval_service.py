from app.services.embedding_service import embed_text
from app.services.vector_service import search_vector


INVENTORY_KEYWORDS = [
    "몇 개", "몇개", "몇", "재고", "남았", "남아", "수량", "현재고", "가용재고"
]


def is_inventory_query(query: str) -> bool:
    return any(keyword in query for keyword in INVENTORY_KEYWORDS)


def retrieve_context(query: str, repository_id: str, limit: int = 5) -> list[dict]:
    query_vector = embed_text(query)

    # 재고 질문은 더 많이 가져온 뒤 재정렬
    raw_results = search_vector(query_vector, repository_id, limit=15)

    if is_inventory_query(query):
        raw_results = rerank_inventory_results(query, raw_results)

    return raw_results[:limit]


def rerank_inventory_results(query: str, results: list[dict]) -> list[dict]:
    product_keywords = extract_simple_product_keywords(query)

    def score_boost(r: dict) -> int:
        text = r.get("text", "")
        filename = r.get("filename", "")
        source_type = r.get("source_type", "")
        sheet_name = r.get("sheet_name") or ""

        score = 0

        # XLSX 우선
        if source_type == "xlsx" or filename.endswith(".xlsx"):
            score += 100

        # 재고 파일/시트 우선
        if "재고" in filename:
            score += 80

        if "재고" in sheet_name:
            score += 80

        # 현재고/수량 컬럼 포함 우선
        for keyword in ["현재고", "재고", "수량", "가용재고", "안전재고"]:
            if keyword in text:
                score += 30

        # 제품명 포함
        for keyword in product_keywords:
            if keyword and keyword in text:
                score += 50

        return score

    return sorted(results, key=score_boost, reverse=True)


def extract_simple_product_keywords(query: str) -> list[str]:
    candidates = []

    for token in query.replace("?", "").replace("몇 개", "").replace("몇개", "").split():
        token = token.strip()

        if not token:
            continue

        if token in INVENTORY_KEYWORDS:
            continue

        candidates.append(token)

    # A제품 같은 패턴 보존
    if "A제품" in query:
        candidates.append("A제품")

    return list(set(candidates))