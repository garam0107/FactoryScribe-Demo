from typing import Any
from pydantic import BaseModel


class ApiResponse(BaseModel):
    success: bool
    message: str | None = None
    data: Any = None


def success_response(data: Any = None, message: str = "success"):
    return {
        "success": True,
        "message": message,
        "data": data,
    }


def error_response(message: str, data: Any = None):
    return {
        "success": False,
        "message": message,
        "data": data,
    }