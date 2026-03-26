import boto3
from app.config import settings

bucket_name = settings.s3_bucket_name

s3 = boto3.client(
    "s3",
    region_name="ap-southeast-2"
)

try:
    s3.head_bucket(Bucket=bucket_name)
    print(f"Bucket '{bucket_name}' exists.")
except s3.exceptions.ClientError as e:
    error_code = e.response["Error"]["Code"]
    if error_code == "404":
        print(f"Error: Bucket '{bucket_name}' does not exist.")
    else:
        print(f"Error accessing bucket: {e}")