from sqlmodel import Session, select
from src.database import engine
from src.models import LabeledData


def insert_labeled_data(all_labeled: list):
    """
    Insert annotation data for labeled images into the database.
    Skips if data already exists.
    """
    with Session(engine) as session:
        # Check if data already exists
        existing = session.exec(select(LabeledData).limit(1)).first()
        if existing:
            print("Database already has data. Skipping insert.")
            return

        for item in all_labeled:
            # Split annotations into separate lists for boxes, labels, confidence
            boxes = [ann["bbox"] for ann in item["annotations"]]
            labels = [ann["label"] for ann in item["annotations"]]
            confidence = [ann["confidence"] for ann in item["annotations"]]

            row = LabeledData(
                image_path=item["s3_path"],
                image_width=item["image_width"],
                image_height=item["image_height"],
                boxes=boxes,
                labels=labels,
                confidence=confidence,
                approved=True,
            )
            session.add(row)

        session.commit()
        print(f"Inserted {len(all_labeled)} rows into labeled_data table")


def get_labeled_count() -> int:
    """Check how many labeled rows exist"""
    with Session(engine) as session:
        results = session.exec(select(LabeledData)).all()
        return len(results)