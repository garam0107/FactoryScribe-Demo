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
    ollama_embed_keep_alive: str = "30m"

    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_intent_model: str = "gpt-5.4-mini"
    openai_intent_timeout: int = 30
    openai_answer_model: str = "gpt-5.4-mini"
    openai_answer_timeout: int = 30
    openai_generate_answers: bool = True

    chunk_size: int = 1000
    chunk_overlap: int = 150
    indexing_batch_size: int = 64
    xlsx_general_row_group_size: int = 10
    xlsx_group_max_chars: int = 3000
    embedding_vector_dim: int = 768

    class Config:
        env_file = ".env"


settings = Settings()
