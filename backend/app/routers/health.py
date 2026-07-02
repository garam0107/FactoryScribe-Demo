from fastapi import APIRouter
from app.config import settings
from app.schemas.common import success_response
router = APIRouter()


@router.get(
    "",
    summary="서버 상태 확인",
    description="API 서버가 정상적으로 실행 중인지 확인하기 위한 상태 값을 반환합니다.",
)
def health_check():
    return success_response({
        "status": "ok",
        "app": settings.app_name,
        "env": settings.app_env,
    })
