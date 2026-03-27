from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_name: str = "Tide-Agent"
    debug: bool = False

    # AWS
    aws_region: str = "ap-southeast-2"
    aws_access_key_id: str
    aws_secret_access_key: str
    s3_bucket_name: str

    # Claude
    claude_api_key: str = ""

    # OpenAI (fallback)
    openai_api_key: str = ""

    # HuggingFace
    hf_token: str = ""

    # Database
    database_url: str = ""

    # Auth
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Modal
    modal_token_id: str = ""
    modal_token_secret: str = ""

    # Deployment
    backend_domain: str = "http://localhost:8000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
