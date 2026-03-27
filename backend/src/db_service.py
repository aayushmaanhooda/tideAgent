from sqlmodel import Session, select, text
from src.database import engine
from src.models import LabeledData
from src.aws.s3 import s3_client
from src.config import settings
from typing import Optional

bucket = settings.s3_bucket_name


async def generate_embeddings(batch_size: int = 50):
    """
    For all rows in labeled_data where embedding IS NULL:
    1. Download image bytes from S3
    2. Send batch to Modal DINOv2 GPU function
    3. Write 768-dim embeddings back to the DB

    Runs in batches to avoid sending all 300 images in one Modal call.
    """
    from src.embeddings import generate_embeddings_via_modal

    with Session(engine) as session:
        rows = session.exec(
            select(LabeledData).where(LabeledData.embedding == None)  # noqa: E711
        ).all()

    if not rows:
        print("All embeddings already generated. Skipping.")
        return

    print(f"Generating embeddings for {len(rows)} images via Modal...")

    for batch_start in range(0, len(rows), batch_size):
        batch = rows[batch_start: batch_start + batch_size]

        # Download image bytes from S3
        images_bytes = []
        for row in batch:
            key = row.image_path.replace(f"s3://{bucket}/", "")
            response = s3_client.get_object(Bucket=bucket, Key=key)
            images_bytes.append(response["Body"].read())

        # Generate embeddings on Modal GPU
        embeddings = await generate_embeddings_via_modal(images_bytes)

        # Write back to DB
        with Session(engine) as session:
            for row, embedding in zip(batch, embeddings):
                record = session.get(LabeledData, row.id)
                record.embedding = embedding
                session.add(record)
            session.commit()

        end = min(batch_start + batch_size, len(rows))
        print(f"  {end}/{len(rows)} embeddings saved")

    print("Done! All embeddings generated and stored.")


def get_labeled_count() -> int:
    with Session(engine) as session:
        result = session.exec(text("SELECT COUNT(*) FROM labeled_data")).one()
        return result


def seed_database(labeled_data: Optional[list] = None):
    """
    One-time seed: Insert annotation records into the database.
    Skips if data already exists in DB.

    If labeled_data is provided (from seed_labeled_data), uses it directly
    and avoids re-loading the dataset. If None and DB is empty, reloads
    the dataset as a fallback (e.g. S3 was seeded but DB was wiped).
    """
    count = get_labeled_count()[0]
    print(count)
    if count > 0:
        print(f"Database already has {count} rows. Skipping seed.")
        return

    if labeled_data is None:
        # Fallback: S3 already seeded but DB is empty — reload dataset
        from datasets import load_dataset
        from src.aws.utils import COCO_CATEGORIES
        print("DB empty but S3 already seeded — reloading dataset as fallback...")
        dataset = load_dataset(
            "detection-datasets/coco",
            split="val",
            token=settings.hf_token,
            streaming=True,
        )
        labeled_data = []
        for idx, entry in enumerate(dataset.take(300)):
            objects = entry["objects"]
            boxes, labels, confidence = [], [], []
            for j in range(len(objects["bbox"])):
                x_min, y_min, w, h = objects["bbox"][j]
                boxes.append([round(x_min, 2), round(y_min, 2), round(x_min + w, 2), round(y_min + h, 2)])
                labels.append(COCO_CATEGORIES.get(objects["category"][j], "unknown"))
                confidence.append(1.0)
            labeled_data.append({
                "s3_path": f"s3://{bucket}/labeled/img_{idx:04d}.jpg",
                "image_width": entry["width"],
                "image_height": entry["height"],
                "boxes": boxes,
                "labels": labels,
                "confidence": confidence,
            })

    print(f"Seeding database with {len(labeled_data)} annotation records...")
    with Session(engine) as session:
        for idx, item in enumerate(labeled_data):
            session.add(LabeledData(
                image_path=item["s3_path"],
                image_width=item["image_width"],
                image_height=item["image_height"],
                boxes=item["boxes"],
                labels=item["labels"],
                confidence=item["confidence"],
                approved=True,
            ))
            if (idx + 1) % 50 == 0:
                print(f"  {idx + 1}/{len(labeled_data)} inserted")
        session.commit()

    print(f"Done! {len(labeled_data)} annotation records in database")


def find_similar_images(query_embedding: list[float], top_k: int = 5) -> list[dict]:
    """
    pgvector cosine similarity search.
    Returns top_k most similar images with full annotation data for Claude context.
    """
    with Session(engine) as session:
        result = session.exec(
            text("""
                SELECT id, image_path, image_width, image_height, labels, boxes, confidence,
                       1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
                FROM labeled_data
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> CAST(:embedding AS vector)
                LIMIT :top_k
            """),
            params={"embedding": str(query_embedding), "top_k": top_k},
        ).all()

    return [
        {
            "id": row[0],
            "image_path": row[1],
            "image_width": row[2],
            "image_height": row[3],
            "labels": row[4],
            "boxes": row[5],
            "confidence": row[6],
            "similarity": round(float(row[7]), 4),
        }
        for row in result
    ]


def approve_image(db_id: int, boxes: list, labels: list, confidence: list) -> LabeledData:
    """
    Called when a human approves an annotated image.

    1. Moves the image in S3 from unlabeled/ → labeled/
    2. Updates the DB record: stores final annotations and sets approved=True.
    """
    with Session(engine) as session:
        record = session.get(LabeledData, db_id)
        if record is None:
            raise ValueError(f"No LabeledData record with id={db_id}")

        # Move S3 object: unlabeled/ → labeled/
        old_key = record.image_path.replace(f"s3://{bucket}/", "")
        if old_key.startswith("unlabeled/"):
            new_key = old_key.replace("unlabeled/", "labeled/", 1)
            s3_client.copy_object(
                Bucket=bucket,
                CopySource={"Bucket": bucket, "Key": old_key},
                Key=new_key,
            )
            s3_client.delete_object(Bucket=bucket, Key=old_key)
            record.image_path = f"s3://{bucket}/{new_key}"

        record.boxes = boxes
        record.labels = labels
        record.confidence = confidence
        record.approved = True
        session.add(record)
        session.commit()
        session.refresh(record)
        return record