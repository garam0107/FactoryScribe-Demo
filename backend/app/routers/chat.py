from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.schemas.chat import ChatRequest
from app.schemas.common import success_response
from app.services.chat_service import ask_question

router = APIRouter()


@router.post("/ask")
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