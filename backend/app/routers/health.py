from fastapi import APIRouter
from app.config import settings
from app.schemas.common import success_response
router = APIRouter()


@router.get("")
def health_check():
    return success_response({
        "status": "ok",
        "app": settings.app_name,
        "env": settings.app_env,
    })