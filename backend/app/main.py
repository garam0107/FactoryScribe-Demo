from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_db_and_tables

# 모델 import 필수
import app.models  # noqa

from app.routers import (
    business_documents,
    chat,
    health,
    indexing,
    inventory,
    purchase_recommendations,
    quotations,
    repositories,
    transactions,
)


app = FastAPI(title="FactoryScribe DEOM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.on_event("startup")
def on_startup():
    create_db_and_tables()


app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(repositories.router, prefix="/repositories", tags=["repositories"])
app.include_router(indexing.router, prefix="/indexing", tags=["indexing"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(quotations.router, prefix="/quotations", tags=["quotations"])
app.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
app.include_router(
    purchase_recommendations.router,
    prefix="/purchase-recommendations",
    tags=["purchase-recommendations"],
)
app.include_router(
    business_documents.router,
    prefix="/business-documents",
    tags=["business-documents"],
)
