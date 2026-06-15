from fastapi import FastAPI

from app.database import create_db_and_tables

# 모델 import 필수
import app.models  # noqa

from app.routers import health, repositories, indexing, chat, quotations


app = FastAPI(title="FactoryScribe DEOM API")


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(repositories.router, prefix="/repositories", tags=["repositories"])
app.include_router(indexing.router, prefix="/indexing", tags=["indexing"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(quotations.router, prefix="/quotations", tags=["quotations"])