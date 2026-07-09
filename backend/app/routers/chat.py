from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.schemas.chat import ChatRequest, SearchTestRequest
from app.schemas.common import success_response
from app.services.chat_service import (
    ask_question,
    get_conversation_messages,
    list_conversations,
    search_documents,
)

router = APIRouter()


@router.post(
    "/ask",
    summary="RAG 기반 질문 답변",
    description=(
        "저장소 검색 결과와 로컬 LLM을 사용해 사용자 질문에 답변합니다. "
        "재고 관련 질문은 구조화된 XLSX/재고 데이터를 우선 근거로 사용합니다."
    ),
)
def ask(req: ChatRequest, session: Session = Depends(get_session)):
    try:
        return ask_question(
            session=session,
            repository_id=req.repository_id,
            conversation_id=req.conversation_id,
            message=req.message,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/conversations",
    summary="대화 히스토리 목록 조회",
    description="저장된 대화 목록을 최신 순으로 조회합니다.",
)
def conversations(repository_id: str, session: Session = Depends(get_session)):
    try:
        return success_response(
            data=list_conversations(session=session, repository_id=repository_id),
            message="대화 목록을 조회했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/conversations/{conversation_id}/messages",
    summary="대화 메시지 조회",
    description="선택한 대화의 메시지를 오래된 순서대로 조회합니다.",
)
def conversation_messages(
    conversation_id: str,
    repository_id: str,
    session: Session = Depends(get_session),
):
    try:
        return success_response(
            data=get_conversation_messages(
                session=session,
                repository_id=repository_id,
                conversation_id=conversation_id,
            ),
            message="대화 메시지를 조회했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/search-test",
    summary="문서 검색 테스트",
    description=(
        "채팅 답변을 생성하지 않고 검색 결과만 반환합니다. "
        "RAG 검색 품질과 출처 랭킹을 확인할 때 사용합니다."
    ),
)
def search_test(req: SearchTestRequest, session: Session = Depends(get_session)):
    try:
        results = search_documents(
            session=session,
            repository_id=req.repository_id,
            query=req.query,
            limit=req.limit,
        )
        return success_response(
            data={
                "repository_id": req.repository_id,
                "query": req.query,
                "results": results,
            },
            message="검색 결과를 조회했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
