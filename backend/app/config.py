from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "FactoryScribe MVP"
    app_env: str = "development"

    sqlite_path: str = "./data/factoryscribe.db"
    lancedb_path: str = "./data/lancedb_store"
    output_dir: str = "./data/outputs"
    template_dir: str = "./data/templates"

    ollama_base_url: str = "http://localhost:11434"
    ollama_chat_model: str = "qwen3.5:9b"
    ollama_embed_model: str = "embeddinggemma"

    chunk_size: int = 1000
    chunk_overlap: int = 150

    class Config:
        env_file = ".env"


settings = Settings()