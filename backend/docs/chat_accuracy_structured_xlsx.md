# FactoryScribe 데모 채팅 정확도 개선 문서

## 1. 목적

데모 버전의 채팅 질의응답은 지정된 XLSX 양식의 문서만 대상으로 한다.
따라서 모든 질문을 LanceDB 벡터 검색과 LLM 답변 생성에 맡기지 않고,
정확해야 하는 업무 질문은 구조화된 SQLite 데이터를 먼저 조회한다.

핵심 목표는 다음과 같다.

- 재고, 거래처, 견적서, 발주서 질문에서 엉뚱한 문서나 거래처를 답변하지 않는다.
- 질문에 나온 품목명, 거래처명, 문서번호가 실제 데이터에 있을 때만 답변한다.
- 확인되지 않는 내용은 LLM에게 추측시키지 않고 명시적으로 "확인되지 않습니다"라고 답한다.
- Ollama는 계속 사용하되, 핵심 판단은 Python 코드와 SQLite 조회가 맡는다.

## 2. 전체 처리 구조

새 `/chat/ask` 처리 흐름은 다음과 같다.

```text
사용자 질문
↓
규칙 기반 intent 분류
↓
애매하면 Ollama(qwen3.5:9b)로 intent만 분류
↓
DB 기반 entity 추출
↓
intent별 structured handler 실행
↓
확인된 데이터만 템플릿 답변
↓
일반 질문만 LanceDB RAG + Ollama fallback
```

지원 intent는 다음 5개다.

| intent | 역할 |
| --- | --- |
| `inventory_query` | 재고, 수량, 단가, 부족 여부 조회 |
| `partner_history_query` | 거래처 거래 이력, 입출고, 견적서, 발주서 종합 조회 |
| `business_document_query` | 견적서/발주서 존재 여부 및 문서 조회 |
| `quotation_create` | 견적서 생성 요청 처리 |
| `general_xlsx_search` | 위 범주에 속하지 않는 일반 문서 검색 |

## 3. 구조화 데이터 범위

데모 채팅은 아래 구조화 테이블을 우선 사용한다.

| 데이터 | 테이블 | 적재 서비스 |
| --- | --- | --- |
| 재고현황 XLSX | `inventory_items` | `sync_inventory_items` |
| 입출고내역 XLSX | `transaction_records` | `sync_transaction_records` |
| 견적서 XLSX | `quotation_documents`, `quotation_items` | `sync_business_documents` |
| 발주서 XLSX | `purchase_order_documents`, `purchase_order_items` | `sync_business_documents` |

`transaction_records`는 이번 변경에서 추가된 테이블이다.
입출고내역 양식의 주요 컬럼을 행 단위로 저장한다.

저장 필드:

- 거래일자
- 거래번호
- 품목코드
- 품목명
- 거래유형
- 수량
- 단가
- 금액
- 거래처/부서
- 프로젝트/발주번호
- 창고위치
- 담당자
- 원본 파일명
- 원본 시트명
- 원본 행 번호

## 4. 변경된 주요 파일

### 채팅 오케스트레이션

- `backend/app/services/chat_service.py`
  - `/chat/ask`의 핵심 처리 흐름을 담당한다.
  - intent 분류, entity 추출, handler 실행, 대화/출처 저장을 조율한다.
  - `/chat/search-test`는 기존처럼 raw RAG 확인용으로 유지한다.

### intent와 entity

- `backend/app/services/chat_handlers/intent_classifier.py`
  - 1차 규칙 기반 분류를 수행한다.
  - 확신이 낮으면 Ollama에 JSON intent 분류를 요청한다.
  - Ollama 결과가 허용 intent가 아니거나 confidence가 낮으면 `general_xlsx_search`로 보낸다.

- `backend/app/services/chat_handlers/entity_extractor.py`
  - DB에 적재된 품목명, 품목코드, 거래처명 후보를 질문 문자열과 비교한다.
  - `PO-`, `QT-` 문서번호 패턴을 추출한다.
  - 구조화 데이터가 아직 비어 있는 경우를 대비해 일부 회사명 패턴도 보조 추출한다.

### intent별 handler

- `inventory_handler.py`
  - `inventory_items`에서 품목명/품목코드 기준으로 재고를 조회한다.
  - 현재고, 잔여수량, 단가, 부족 여부를 템플릿으로 답변한다.
  - LLM 추론을 사용하지 않는다.

- `partner_history_handler.py`
  - `transaction_records`, `quotation_documents`, `purchase_order_documents`를 모두 확인한다.
  - 질문에 나온 거래처와 매칭되는 결과만 답변한다.
  - 매칭이 없으면 다른 거래처를 대체하지 않고 확인되지 않는다고 답한다.

- `business_document_handler.py`
  - `QT-`, `PO-` 번호가 있으면 번호 기반으로 우선 조회한다.
  - 번호가 없으면 거래처명 기준으로 견적서/발주서를 조회한다.
  - 견적서 또는 발주서가 명시된 질문은 해당 문서 종류를 우선한다.

- `quotation_create_handler.py`
  - 현재는 자유 텍스트에서 견적서를 바로 생성하지 않는다.
  - 필수 필드가 부족하면 필요한 정보를 되묻는다.
  - 견적서 생성 자체는 기존 `quotation_service.create_and_generate_quotation()` 흐름을 유지한다.

- `general_rag_handler.py`
  - 구조화 handler에 속하지 않는 일반 질문만 처리한다.
  - 기존 LanceDB 검색 결과를 Ollama에 전달한다.
  - 깨져 있던 한글 시스템 프롬프트를 정상 문구로 복구했다.

### 입출고내역

- `backend/app/models/transaction_record.py`
  - 입출고내역 행을 저장하는 `TransactionRecord` 모델을 추가했다.

- `backend/app/services/transaction_service.py`
  - 입출고내역 XLSX를 스캔하고 헤더 기반으로 컬럼을 매핑한다.
  - 저장소 단위로 기존 행을 교체한 뒤 새 행을 저장한다.

- `backend/app/routers/transactions.py`
  - 입출고내역 수동 동기화와 조회 API를 추가했다.

## 5. API 변경

기존 `/chat/ask` 응답 구조는 유지하면서 디버깅용 필드를 추가했다.

```json
{
  "success": true,
  "message": "답변을 생성했습니다.",
  "data": {
    "conversation_id": "...",
    "answer": "...",
    "sources": [],
    "intent": "partner_history_query",
    "intent_confidence": 0.9,
    "intent_source": "rule",
    "extracted_entities": {},
    "action": null
  }
}
```

추가된 입출고내역 API:

```text
POST /transactions/repositories/{repository_id}/sync
GET  /transactions/repositories/{repository_id}/records
```

## 6. 운영 순서

데모 저장소를 등록한 뒤 아래 동기화를 수행한다.

```text
1. /indexing/repositories/{repository_id}/scan
2. /indexing/repositories/{repository_id}/index
3. /inventory/repositories/{repository_id}/sync
4. /business-documents/repositories/{repository_id}/sync
5. /transactions/repositories/{repository_id}/sync
```

채팅 정확도만 보면 3, 4, 5가 중요하다.
일반 문서 검색 fallback까지 쓰려면 1, 2도 필요하다.

## 7. 질문별 동작 예시

### 재고 질문

질문:

```text
근접센서 몇 개 남았어?
```

처리:

```text
inventory_query
↓
InventoryItem에서 근접센서 검색
↓
현재고/잔여수량/단가/부족 여부 답변
```

### 거래처 질문

질문:

```text
해안물산이랑 거래한 적 있어?
```

처리:

```text
partner_history_query
↓
transaction_records + quotation_documents + purchase_order_documents 조회
↓
해안물산 결과만 답변
↓
없으면 확인되지 않는다고 답변
```

### 견적서/발주서 질문

질문:

```text
해안물산 견적서나 발주서 있어?
```

처리:

```text
business_document_query
↓
거래처명 기준으로 견적서/발주서 문서 조회
↓
문서번호, 날짜, 거래처, 품목 수, 출처 답변
```

### 견적서 생성 질문

질문:

```text
견적서 생성해줘
```

처리:

```text
quotation_create
↓
필수 정보 안내
↓
충분한 구조화 입력이 생기면 기존 견적서 생성 서비스 호출
```

## 8. 테스트 시나리오

필수 확인 항목:

- `python -m compileall app`
- `import app.main`
- intent 분류:
  - `근접센서 몇 개 남았어?` → `inventory_query`
  - `해안물산이랑 거래한 적 있어?` → `partner_history_query`
  - `해안물산 견적서나 발주서 있어?` → `business_document_query`
  - `견적서 생성해줘` → `quotation_create`
  - `이 문서 요약해줘` → `general_xlsx_search`
- 입출고내역 동기화:
  - `POST /transactions/repositories/{repository_id}/sync`
  - `GET /transactions/repositories/{repository_id}/records`
- 회귀 테스트:
  - 질문에 `해안물산`이 있으면 `한빛전장`, `베트남파트너스` 같은 다른 거래처를 답변에 넣지 않아야 한다.
  - 결과가 없으면 “현재 등록된 데이터에서 확인되지 않습니다”라고 답해야 한다.

## 9. 현재 제한 사항

- 견적서 생성 handler는 아직 자유 텍스트에서 품목/수량/단가를 완전 자동 파싱해 생성하지 않는다.
- 일반 문서 검색 fallback은 여전히 LanceDB 검색 품질의 영향을 받는다.
- 구조화 답변은 데모 XLSX 양식에 맞춰져 있으므로, 다른 양식이 들어오면 별도 파서 보강이 필요하다.
