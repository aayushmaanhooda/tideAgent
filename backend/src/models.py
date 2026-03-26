from sqlmodel import SQLModel, Field, Column
from typing import Any, Optional
from datetime import datetime
from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON

class LabeledData(SQLModel, table=True):
    __tablename__ = "labeled_data"

    id: Optional[int] = Field(default=None, primary_key=True)
    image_path: str
    image_width: int
    image_height: int
    embedding: Any = Field(default=None, sa_column=Column(Vector(768)))
    boxes: Any = Field(default=None, sa_column=Column(JSON))
    labels: Any = Field(default=None, sa_column=Column(JSON))
    confidence: Any = Field(default=None, sa_column=Column(JSON))
    approved: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)