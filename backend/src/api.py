import asyncio
from collections.abc import AsyncIterable
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.sse import ServerSentEvent, EventSourceResponse
from src.db_service import find_similar_images
from src.embeddings import generate_embeddings_via_modal
from src.grounding import run_grounding_dino_via_modal
from src.aws.s3 import get_presigned_url, s3_client, bucket_name
from src.agent import get_detection_labels

router = APIRouter()


def _download_s3_bytes(image_path: str) -> bytes:
    """boto3 is sync — runs in threadpool executor"""
    key = image_path.replace(f"s3://{bucket_name}/", "")
    response = s3_client.get_object(Bucket=bucket_name, Key=key)
    return response["Body"].read()


@router.post("/similar")
async def similar_images(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    new_image_bytes = await file.read()

    embeddings = await generate_embeddings_via_modal([new_image_bytes])
    query_embedding = embeddings[0]

    matches = find_similar_images(query_embedding, top_k=5)

    context_image_bytes = await asyncio.gather(*[
        asyncio.to_thread(_download_s3_bytes, m["image_path"])
        for m in matches
    ])

    context = [
        {"image_bytes": img_bytes, "labels": match["labels"], "boxes": match["boxes"]}
        for img_bytes, match in zip(context_image_bytes, matches)
    ]

    raw_labels = await get_detection_labels(new_image_bytes, context)

    label_counts = {}
    for label in raw_labels:
        label_counts[label] = label_counts.get(label, 0) + 1
    suggested_labels = [
        f"{label} ({count})" if count > 1 else label
        for label, count in label_counts.items()
    ]

    for match in matches:
        match["image_url"] = get_presigned_url(match.pop("image_path"))

    return {"results": matches, "suggested_labels": suggested_labels}


@router.post("/annotate", response_class=EventSourceResponse)
async def annotate_image(file: UploadFile = File(...)) -> AsyncIterable[ServerSentEvent]:
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()

    try:
        # ── Step 1: DINOv2 embedding ──────────────────────────────
        yield ServerSentEvent(data={"type": "step", "step": "embedding", "status": "running",
                                    "detail": "Generating DINOv2 embedding..."})
        embeddings = await generate_embeddings_via_modal([image_bytes])
        query_embedding = embeddings[0]
        yield ServerSentEvent(data={"type": "step", "step": "embedding", "status": "done",
                                    "detail": "Embedding generated (768-dim)"})

        # ── Step 2: pgvector similarity search ────────────────────
        yield ServerSentEvent(data={"type": "step", "step": "similarity", "status": "running",
                                    "detail": "Searching for similar images..."})
        matches = find_similar_images(query_embedding, top_k=5)
        context_image_bytes = await asyncio.gather(*[
            asyncio.to_thread(_download_s3_bytes, m["image_path"])
            for m in matches
        ])
        top_score = round(matches[0]["similarity"] * 100, 1) if matches else 0
        yield ServerSentEvent(data={"type": "step", "step": "similarity", "status": "done",
                                    "detail": f"Found {len(matches)} similar images (top: {top_score}% match)"})

        # ── Step 3: Claude Vision → labels ────────────────────────
        yield ServerSentEvent(data={"type": "step", "step": "claude", "status": "running",
                                    "detail": "Claude analyzing annotation style..."})
        context = [
            {"image_bytes": img_bytes, "labels": match["labels"], "boxes": match["boxes"]}
            for img_bytes, match in zip(context_image_bytes, matches)
        ]
        raw_labels = await get_detection_labels(image_bytes, context)
        unique_labels = list(dict.fromkeys(raw_labels))
        yield ServerSentEvent(data={"type": "step", "step": "claude", "status": "done",
                                    "detail": f"Detected {len(unique_labels)} label types: {', '.join(unique_labels[:6])}"})

        # ── Step 4: Grounding DINO → bounding boxes ───────────────
        yield ServerSentEvent(data={"type": "step", "step": "grounding_dino", "status": "running",
                                    "detail": "Running Grounding DINO for precise bounding boxes..."})
        annotations = await run_grounding_dino_via_modal(image_bytes, unique_labels)
        yield ServerSentEvent(data={"type": "step", "step": "grounding_dino", "status": "done",
                                    "detail": f"Found {len(annotations)} objects"})

        # ── Final result ──────────────────────────────────────────
        from PIL import Image
        import io
        pil = Image.open(io.BytesIO(image_bytes))
        width, height = pil.size

        yield ServerSentEvent(data={
            "type": "result",
            "annotations": annotations,
            "width": width,
            "height": height,
        })

    except Exception as e:
        yield ServerSentEvent(data={"type": "error", "message": str(e)})
