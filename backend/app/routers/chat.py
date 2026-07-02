from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.schemas.chat import ChatRequest, SearchTestRequest
from app.schemas.common import success_response
from app.services.chat_service import ask_question, search_documents

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
