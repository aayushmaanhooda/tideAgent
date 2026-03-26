import boto3
from src.config import settings

bucket_name = settings.s3_bucket_name

s3_client = boto3.client(
    "s3",
    region_name=settings.aws_region,
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
)

try:
    s3_client.head_bucket(Bucket=bucket_name)
    print(f"Bucket '{bucket_name}' exists.")
except s3_client.exceptions.ClientError as e:
    error_code = e.response["Error"]["Code"]
    if error_code == "404":
        print(f"Error: Bucket '{bucket_name}' does not exist.")
    else:
        print(f"Error accessing bucket: {e}")