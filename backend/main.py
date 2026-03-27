from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from src import api
from src.aws.utils import seed_labeled_data
from contextlib import asynccontextmanager
from src.database import create_db_and_tables
from src.db_service import seed_database, generate_embeddings
from src import models  # noqa: F401 - registers SQLModel metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("TIDE Agent starting up...")
    create_db_and_tables()
    labeled_data = seed_labeled_data()  # uploads to S3, returns data (None if already seeded)
    seed_database(labeled_data)         # uses returned data — no second dataset load
    await generate_embeddings()         # generates DINOv2 embeddings via Modal (skips if already done)
    print("TIDE Agent ready!")
    yield
    print("TIDE Agent shutting down...")

app = FastAPI(title="Tide Annotation Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://tide-agent.vercel.app",
        "http://tide-agent.duckdns.org",
        "https://tide-agent.duckdns.org",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

v1 = APIRouter(prefix="/v1")
v1.include_router(api.router)
app.include_router(v1)


@app.get("/")
def root():
    return {"message": "I am Tide Annotation Agent Root"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
