from fastapi import APIRouter
from app.config import settings

router = APIRouter()


@router.get("")
def health_check():
    return {
        "status": "ok",
        "app": settings.app_name,
        "env": settings.app_env,
    }