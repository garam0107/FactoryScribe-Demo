# Indexing Performance Improvements

이 문서는 `/indexing/repositories/{repository_id}/index` API의 인덱싱 속도 개선 내용을 정리한다.

## 기존 구조

기존 인덱싱 흐름은 청크 단위 순차 처리였다.

```text
pending 문서 조회
-> 문서 1개 파싱
-> 청크 생성
-> 청크 1개마다 Ollama /api/embed 호출
-> 청크 1개마다 LanceDB table.add 호출
-> DocumentChunk 메타 저장
-> 다음 문서 처리
```

이 구조에서는 청크가 10,000개이면 Ollama HTTP 요청도 10,000번 발생한다. 대량 문서 저장소에서는 임베딩 HTTP 호출 횟수와 LanceDB 쓰기 횟수가 가장 큰 병목이 된다.

## 개선된 구조

현재 인덱싱 흐름은 배치 처리 중심으로 변경되었다.

```text
pending 또는 indexing 문서 조회
-> 기존 document_id의 벡터와 청크 메타 정리
-> 문서 상태를 indexing으로 변경
-> 문서 파싱
-> 청크 생성
-> 청크를 indexing_batch_size 단위로 분할
-> 배치마다 Ollama /api/embed 호출
-> 배치마다 LanceDB table.add 호출
-> DocumentChunk 메타를 배치 단위로 세션에 추가
-> 문서 상태를 indexed, empty, failed 중 하나로 변경
```

예를 들어 `indexing_batch_size=64`이고 청크가 10,000개라면, Ollama 호출 횟수는 약 157회로 줄어든다.

## 변경 사항

### 1. 배치 임베딩

`app/services/embedding_service.py`에 `embed_texts(texts: list[str])`를 추가했다.

Ollama `/api/embed`의 `input`에 문자열 리스트를 전달하여 여러 청크를 한 번에 임베딩한다.

기존 `embed_text(text)`는 호환성을 위해 유지하며 내부에서 `embed_texts([text])`를 사용한다.

### 2. Ollama keep_alive

임베딩 요청 payload에 `keep_alive`를 추가했다.

기본값은 `30m`이다. 여러 배치를 연속 처리할 때 Ollama가 모델을 반복적으로 unload/load하는 비용을 줄이기 위한 설정이다.

환경 변수로 조정할 수 있다.

```text
OLLAMA_EMBED_KEEP_ALIVE=30m
```

### 3. 배치 LanceDB 저장

`app/services/vector_service.py`에 `add_vector_chunks(records: list[dict])`를 추가했다.

기존에는 청크마다 `table.add([record])`를 호출했지만, 이제 배치 단위로 `table.add(records)`를 호출한다.

기존 `add_vector_chunk(record)`는 호환성을 위해 유지한다.

### 4. 실제 임베딩 차원 기반 테이블 생성

LanceDB 테이블이 없을 때는 첫 배치의 실제 벡터 차원을 기준으로 테이블을 생성한다.

검색 요청이 먼저 들어온 경우에는 빈 테이블을 만들지 않고 빈 결과를 반환한다. 이렇게 해야 실제 임베딩 차원과 다른 기본 차원으로 테이블이 먼저 만들어지는 문제를 피할 수 있다.

기본 fallback 값은 설정으로 관리한다.

```text
EMBEDDING_VECTOR_DIM=768
```

### 5. empty 상태 추가

파싱은 성공했지만 검색 가능한 청크가 하나도 없는 문서는 `indexed`가 아니라 `empty`로 표시한다.

예시는 다음과 같다.

```text
indexed_status=empty
error_message=no extractable text chunks
chunk_count=0
```

이 상태는 PDF가 이미지 기반이거나, XLSX/DOCX에서 추출 가능한 텍스트가 없는 경우를 구분하기 위한 것이다.

### 6. 부분 실패 정리

문서 인덱싱 중간에 오류가 발생하면 해당 `document_id`의 LanceDB 벡터와 `DocumentChunk` 메타를 정리한 뒤 문서 상태를 `failed`로 변경한다.

이를 통해 다음과 같은 부분 인덱싱 상태를 줄인다.

```text
청크 100개 중 60개 저장
-> 61번째 배치 실패
-> 문서는 failed
-> 하지만 검색에는 60개가 남아 있음
```

현재 구조에서는 실패 시 해당 문서의 벡터와 청크 메타를 삭제한다.

### 7. indexing 상태 재시도

인덱싱 대상 조회 시 `pending`뿐 아니라 `indexing` 상태도 포함한다.

서버 중단 등으로 문서가 `indexing` 상태에 남아 있으면 다음 인덱싱 요청에서 다시 처리할 수 있다.

### 8. 저장소별 중복 스캔

문서 스캔 시 중복 기준을 전역 `file_hash`에서 `repository_id + file_hash`로 변경했다.

같은 파일이 다른 저장소에 있을 때 두 번째 저장소의 문서 등록이 누락되는 문제를 피하기 위한 변경이다.

### 9. 문서 목록 오류 메시지

`GET /repositories/{repository_id}/documents` 응답에 `error_message`를 포함한다.

`chunk_count=0`일 때 원인이 `empty`인지 `failed`인지 API 응답만으로 확인할 수 있다.

### 10. 인덱싱 결과 지표

`/index` 응답에 다음 지표를 추가했다.

```json
{
  "documents": 10,
  "indexed": 8,
  "empty": 1,
  "failed": 1,
  "chunks": 512,
  "embedding_batches": 8,
  "batch_size": 64,
  "elapsed_seconds": 12.345
}
```

이 값으로 배치 처리 효과와 실제 처리량을 확인할 수 있다.

### 11. XLSX 일반 시트 행 묶음

XLSX는 시트 유형을 간단히 추정한 뒤 청크 전략을 다르게 적용한다.

```text
inventory / bom / cost: 행 단위 청크 유지
general: xlsx_general_row_group_size 단위로 여러 행을 한 청크로 묶음
```

재고표는 `현재고`, `가용재고`, `예약수량`처럼 행 단위 정확도가 중요하므로 기존처럼 한 행을 한 청크로 유지한다. BOM 성격의 시트도 품번, 부품, 자재 단위 조회가 많기 때문에 행 단위를 유지한다. 견적서/예산서 성격의 cost 시트도 단가와 금액 질의의 출처 정밀도를 위해 행 단위를 유지한다.

일반 표는 기본적으로 10행을 하나의 청크로 묶는다. 대량 XLSX에서 임베딩해야 하는 청크 수를 줄이기 위한 설정이다.

일반 표라도 청크 텍스트가 너무 길어지는 것을 막기 위해 `xlsx_group_max_chars`를 넘으면 10행을 채우기 전에 청크를 끊는다.

출처는 단일 행이면 `Row 4`, 묶음 청크이면 `Row 4-13`처럼 표시된다.

## 설정값

`app/config.py`에 다음 설정이 추가되었다.

```python
ollama_embed_keep_alive: str = "30m"
indexing_batch_size: int = 64
xlsx_general_row_group_size: int = 10
xlsx_group_max_chars: int = 3000
embedding_vector_dim: int = 768
```

`.env`에서는 다음처럼 조정할 수 있다.

```text
OLLAMA_EMBED_KEEP_ALIVE=30m
INDEXING_BATCH_SIZE=64
XLSX_GENERAL_ROW_GROUP_SIZE=10
XLSX_GROUP_MAX_CHARS=3000
EMBEDDING_VECTOR_DIM=768
```

## 배치 크기 기준

초기값은 `64`를 권장한다.

배치 크기를 키우면 HTTP 요청 횟수는 줄지만, Ollama 응답 시간이 길어지고 메모리 사용량이 증가할 수 있다.

권장 조정 기준은 다음과 같다.

```text
로컬 CPU 위주 환경: 16 또는 32
일반 데모 PC: 64
메모리 여유가 있고 Ollama가 안정적인 환경: 128
```

## 남은 개선 후보

현재 개선은 API 구조를 크게 바꾸지 않고 속도를 줄이는 1차 개선이다.

추가로 개선할 수 있는 항목은 다음과 같다.

```text
1. 저장소 인덱싱 진행률 조회 API
2. 백그라운드 작업 방식의 인덱싱 API
3. failed 문서만 재시도하는 API
4. 기존 indexed 문서의 파일 변경 감지 후 재인덱싱
5. 실제 데모 문서 기반 XLSX 문서 타입 분류 규칙 보강
```

MVP 단계에서는 먼저 배치 임베딩과 배치 저장 효과를 확인한 뒤, 실제 문서 수와 청크 수 기준으로 위 항목을 순차 적용하는 것이 좋다.
