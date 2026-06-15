# AGENTS.md

# FactoryScribe MVP Development Guide

이 프로젝트는 제조업 문서 검색 및 견적서 자동화 플랫폼인 FactoryScribe의 MVP(데모 버전)이다.

목표는 기업 시연용 데모를 빠르게 완성하는 것이며, 복잡한 멀티 에이전트 구조보다 안정적이고 디버깅 가능한 구조를 우선한다.

---

# 프로젝트 목표

현재 MVP 범위:

* 문서 저장소 등록
* PDF 읽기
* DOCX 읽기
* XLSX 읽기
* HWPX 읽기 (예정)
* LanceDB 인덱싱
* Ollama Embedding
* RAG 검색
* 채팅 질의응답
* 출처 표시
* 견적서 XLSX 생성

현재 구현 완료:

* Repository 등록
* 문서 스캔
* 문서 인덱싱
* PDF Parser
* DOCX Parser
* XLSX Parser
* LanceDB 저장
* Ollama Embedding
* RAG 기반 채팅
* 출처 표시
* 견적서 XLSX 생성

---

# 절대 원칙

## 1. LangGraph 사용 금지

현재 MVP에서는 LangGraph를 사용하지 않는다.

Agent는 상태머신으로 구현한다.

현재 필요한 기능:

* 문서 검색
* 질의응답
* 견적서 생성

뿐이다.

LangGraph는 승인 워크플로우가 필요해질 때만 추가한다.

---

## 2. 복잡한 Agent 구조 금지

다음과 같은 구조 금지:

* Planner Agent
* Research Agent
* Critic Agent
* Reflection Agent
* Multi Agent

현재 MVP에서는 필요하지 않다.

사용 구조:

Question
↓
Retrieve
↓
Prompt Build
↓
Ollama
↓
Response

---

## 3. RAG 우선

LLM 추론보다 검색 결과를 우선한다.

규칙:

* 검색 결과에 없는 내용은 생성하지 않는다.
* 검색 결과에 없는 수량을 추론하지 않는다.
* 검색 결과에 없는 단가를 추론하지 않는다.
* 검색 결과에 없는 날짜를 추론하지 않는다.

---

## 4. 제조업 질문은 구조화 우선

질문 예시:

* A제품 몇 개 남았지?
* A제품 단가 얼마야?
* A제품 품번 뭐야?

이 경우:

LLM 자유 생성 금지

반드시 검색 결과에서:

현재고=
예약수량=
가용재고=
단가=
품번=

등을 직접 추출하여 답변 생성

---

# 기술 스택

Backend:

* FastAPI

Database:

* SQLite

Vector DB:

* LanceDB

Embedding:

* Ollama embedding model

Chat:

* Ollama

Documents:

* PDF
* DOCX
* XLSX
* HWPX(예정)

Output:

* XLSX

---

# 현재 디렉토리 구조

backend/

app/

models/

routers/

schemas/

services/

parsers/

data/

templates/

outputs/

requirements.txt

---

# API 응답 규칙

모든 성공 응답은 동일한 구조를 사용한다.

{
"success": true,
"message": "...",
"data": {}
}

실패:

{
"success": false,
"message": "...",
"data": null
}

새 API를 만들 때 반드시 적용한다.

---

# 검색 시스템 규칙

질문

↓

Embedding

↓

LanceDB Search

↓

Rerank

↓

Prompt Build

↓

Ollama

↓

Response

순서 유지

---

# 재고 질문 우선순위

질문에 아래 단어가 포함되면:

* 재고
* 수량
* 몇 개
* 몇개
* 남았
* 가용재고
* 현재고

XLSX 결과를 우선 사용한다.

PDF가 XLSX보다 높은 점수를 받아도

재고 질문이면 XLSX 우선

---

# 출처 표시 규칙

모든 답변은 출처를 포함한다.

예:

재고현황.xlsx / 제품재고 / Row 4

또는

A제품_제품사양서.pdf / Page 1

출처 없는 답변 생성 금지

---

# XLSX Parser 규칙

엑셀 첫 줄을 무조건 헤더로 가정하지 않는다.

헤더 자동 탐지 사용.

검색용 텍스트는 아래 형태 유지:

파일명=재고현황.xlsx,
시트=제품재고,
행=4,
제품명=A제품,
품번=A-001,
현재고=37,
예약수량=5,
가용재고=32

---

# LanceDB 규칙

Vector Column Name:

vector

Vector Search 시 반드시:

vector_column_name="vector"

사용

---

# 현재 완료된 API

POST /repositories

GET /repositories

POST /indexing/repositories/{repository_id}/scan

POST /indexing/repositories/{repository_id}/index

POST /chat/ask

POST /quotations/generate-xlsx

---

# 다음 구현 순서

우선순위 순서대로 구현

1.

GET /repositories/{repository_id}/documents

문서 목록 조회

2.

POST /chat/search-test

검색 결과만 확인

3.

채팅 품질 개선

4.

재고 질문 구조화 응답

5.

단가 질문 구조화 응답

6.

품번 질문 구조화 응답

7.

견적서 생성과 채팅 연결

8.

파일 다운로드 API

9.

프론트 개발

---

# 프론트 개발 금지 조건

백엔드 기능이 완성되기 전까지

React
Tauri
Electron

작업 금지

모든 기능은 Postman으로 먼저 검증한다.

---

# 코딩 원칙

* 단순하게 구현
* 과도한 추상화 금지
* 과도한 디자인 패턴 금지
* MVP 우선
* 유지보수성 우선
* 디버깅 가능성 우선
* 제조업 데모 성공이 최우선

완벽한 구조보다
시연 가능한 구조를 우선한다.
