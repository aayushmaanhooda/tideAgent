import modal

app = modal.App("tide-dinov2")

dinov2_image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "torch",
    "torchvision",
    "transformers",
    "Pillow",
)


@app.function(
    image=dinov2_image,
    gpu="any",
    timeout=600,
)
def get_embedding(image_bytes: bytes) -> list:
    """Takes image bytes, returns 768-dim embedding as a list"""
    import torch
    from transformers import AutoImageProcessor, AutoModel
    from PIL import Image
    import io

    processor = AutoImageProcessor.from_pretrained("facebook/dinov2-base")
    model = AutoModel.from_pretrained("facebook/dinov2-base").to("cuda")
    model.eval()

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    inputs = processor(images=image, return_tensors="pt").to("cuda")
    with torch.no_grad():
        outputs = model(**inputs)

    embedding = outputs.last_hidden_state[:, 1:, :].mean(dim=1)
    return embedding[0].cpu().numpy().tolist()


@app.function(
    image=dinov2_image,
    gpu="any",
    timeout=1800,
)
def get_embeddings_batch(images_bytes_list: list) -> list:
    """Process multiple images in one GPU call — model loaded once for efficiency"""
    import torch
    from transformers import AutoImageProcessor, AutoModel
    from PIL import Image
    import io

    processor = AutoImageProcessor.from_pretrained("facebook/dinov2-base")
    model = AutoModel.from_pretrained("facebook/dinov2-base").to("cuda")
    model.eval()

    embeddings = []
    for idx, img_bytes in enumerate(images_bytes_list):
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        inputs = processor(images=image, return_tensors="pt").to("cuda")
        with torch.no_grad():
            outputs = model(**inputs)
        embedding = outputs.last_hidden_state[:, 1:, :].mean(dim=1)
        embeddings.append(embedding[0].cpu().numpy().tolist())

        if (idx + 1) % 50 == 0:
            print(f"  {idx + 1}/{len(images_bytes_list)} done")

    return embeddings


@app.function(
    image=dinov2_image,
    gpu="any",
    timeout=300,
)
def run_grounding_dino(image_bytes: bytes, labels: list) -> list:
    """
    Runs Grounding DINO on an image with text labels.
    Returns list of {label, bbox: [x1,y1,x2,y2], confidence}
    """
    import torch
    from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
    from PIL import Image
    import io

    model_id = "IDEA-Research/grounding-dino-tiny"
    processor = AutoProcessor.from_pretrained(model_id)
    model = AutoModelForZeroShotObjectDetection.from_pretrained(model_id).to("cuda")
    model.eval()

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Grounding DINO expects labels as "label1. label2. label3."
    labels_text = ". ".join(labels) + "."

    inputs = processor(images=image, text=labels_text, return_tensors="pt").to("cuda")
    with torch.no_grad():
        outputs = model(**inputs)

    results = processor.post_process_grounded_object_detection(
        outputs,
        inputs["input_ids"],
        threshold=0.2,
        target_sizes=[image.size[::-1]],
    )[0]

    annotations = []
    for box, score, label in zip(results["boxes"], results["scores"], results["text_labels"]):
        x1, y1, x2, y2 = box.tolist()
        annotations.append({
            "bbox": [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
            "label": label,
            "confidence": round(score.item(), 3),
        })

    print(f"  Found {len(annotations)} objects")
    return annotations


@app.local_entrypoint()
def main():
    """Test with a sample image"""
    from PIL import Image
    import io

    img = Image.new("RGB", (224, 224), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    result = get_embedding.remote(buf.getvalue())
    print(f"Embedding length: {len(result)}")
    print(f"First 5 values: {result[:5]}")
