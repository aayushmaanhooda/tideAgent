from src.aws.s3 import s3_client
from datasets import load_dataset
from src.config import settings
from botocore.exceptions import ClientError
import io


bucket = settings.s3_bucket_name

COCO_CATEGORIES = {
    0: "person", 1: "bicycle", 2: "car", 3: "motorcycle", 4: "airplane",
    5: "bus", 6: "train", 7: "truck", 8: "boat", 9: "traffic light",
    10: "fire hydrant", 11: "stop sign", 12: "parking meter", 13: "bench",
    14: "bird", 15: "cat", 16: "dog", 17: "horse", 18: "sheep", 19: "cow",
    20: "elephant", 21: "bear", 22: "zebra", 23: "giraffe", 24: "backpack",
    25: "umbrella", 26: "handbag", 27: "tie", 28: "suitcase", 29: "frisbee",
    30: "skis", 31: "snowboard", 32: "sports ball", 33: "kite",
    34: "baseball bat", 35: "baseball glove", 36: "skateboard", 37: "surfboard",
    38: "tennis racket", 39: "bottle", 40: "wine glass", 41: "cup", 42: "fork",
    43: "knife", 44: "spoon", 45: "bowl", 46: "banana", 47: "apple",
    48: "sandwich", 49: "orange", 50: "broccoli", 51: "carrot", 52: "hot dog",
    53: "pizza", 54: "donut", 55: "cake", 56: "chair", 57: "couch",
    58: "potted plant", 59: "bed", 60: "dining table", 61: "toilet", 62: "tv",
    63: "laptop", 64: "mouse", 65: "remote", 66: "keyboard", 67: "cell phone",
    68: "microwave", 69: "oven", 70: "toaster", 71: "sink", 72: "refrigerator",
    73: "book", 74: "clock", 75: "vase", 76: "scissors", 77: "teddy bear",
    78: "hair drier", 79: "toothbrush"
}

def check_seed_data_exists(s3_client, bucket):
    """Check if labeled images are already in S3"""
    try:
        response = s3_client.list_objects_v2(Bucket=bucket, Prefix="labeled/", MaxKeys=10)
        keys = [obj["Key"] for obj in response.get("Contents", []) if not obj["Key"].endswith("/")]
        return len(keys) > 0
    except ClientError:
        return False

def seed_labeled_data(num_images=300, bucket=bucket):
    """
    One-time seed: Upload labeled COCO images to S3.
    Returns annotation data to be stored in the database.
    Skips if images already exist.
    """
   
    # Check if already seeded
    if check_seed_data_exists(s3_client, bucket):
        print("Labeled data already exists in S3. Skipping upload.")
        return None
    
    print(f"Seeding {num_images} labeled images to S3...")
    dataset = load_dataset("detection-datasets/coco", split="val", token=settings.hf_token, streaming=True)

    all_labeled = []

    for idx, entry in enumerate(dataset.take(num_images)):
        image = entry["image"]
        objects = entry["objects"]
        
        # Upload image directly to S3 from memory
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="JPEG", quality=95)
        buffer.seek(0)
        
        s3_key = f"labeled/img_{idx:04d}.jpg"
        s3_client.upload_fileobj(buffer, bucket, s3_key)
        
        # Extract annotations
        annotations = []
        for j in range(len(objects["bbox"])):
            x_min, y_min, w, h = objects["bbox"][j]
            label = COCO_CATEGORIES.get(objects["category"][j], "unknown")
            annotations.append({
                "bbox": [round(x_min, 2), round(y_min, 2), round(x_min + w, 2), round(y_min + h, 2)],
                "label": label,
                "confidence": 1.0
            })
        
        all_labeled.append({
            "image_id": idx,
            "s3_path": f"s3://{bucket}/{s3_key}",
            "image_width": entry["width"],
            "image_height": entry["height"],
            "annotations": annotations
        })
        
        if (idx + 1) % 50 == 0:
            print(f"  {idx + 1}/{num_images} uploaded")
    
    print(f"Done! {len(all_labeled)} labeled images in S3")
    return all_labeled


def upload_unlabeled_image(image_bytes, filename, bucket):
    """
    Called when user uploads a new image through the UI.
    Returns the S3 path.
    """
    s3_key = f"unlabeled/{filename}"
    s3_client.upload_fileobj(io.BytesIO(image_bytes), bucket, s3_key)
    return f"s3://{bucket}/{s3_key}"

