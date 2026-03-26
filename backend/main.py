from fastapi import FastAPI, APIRouter
from src import api
from src.aws.utils import seed_labeled_data
from contextlib import asynccontextmanager
from src.database import create_db_and_tables

from src import models  # noqa: F401 - registers SQLModel metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("TIDE Agent starting up...")
    create_db_and_tables()
    all_labeled = seed_labeled_data()
    if all_labeled:
        pass
        # insert_labeled_data(all_labeled)
    # print("TIDE Agent ready!")
    yield
    print("TIDE Agent shutting down...")

app = FastAPI(title="Tide Annotation Agent", lifespan=lifespan)

v1 = APIRouter(prefix="/v1")
v1.include_router(api.router)
app.include_router(v1)


@app.get("/")
def root():
    return {"message": "I am Tide Annotation Agent Root"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)
