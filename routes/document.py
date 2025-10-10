import uuid
from urllib.parse import urlparse

import boto3
from botocore.exceptions import ClientError
from flask import Blueprint, request, jsonify
from config import AWS_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY,AWS_DEFAULT_REGION,BUCKET_NAME,MAX_FILE_SIZE_MB
import os
from utils.helpers import make_response

s3_bp = Blueprint("s3_bp", __name__)

#BUCKET_NAME = "wethink-storage"
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "pdf","csv","png"}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_DEFAULT_REGION
)

@s3_bp.route("/upload", methods=["POST"])
def upload_files():
    """
    Upload multiple files to S3 with name mapping and rollback on failure.
    Validates file types and size.
    Expected FormData:
        files[aadhar_front]: <File>
        files[aadhar_back]: <File>
    Returns:
        {
          "aadhar_front": "https://...",
          "aadhar_back": "https://..."
        }
    """
    if not request.files:
        return make_response(error=True, message="No files provided", status=400)

    uploaded_map = {}
    uploaded_keys = []

    for key, file in request.files.items():
        # Validate key format: files[name]
        if not key.startswith("files[") or not key.endswith("]"):
            return make_response(
                error=True,
                message=f"Invalid form key: {key}. Expected 'files[custom_name]' format.",
                status=400
            )

        name = key[len("files["):-1]

        # Check allowed file type
        if not allowed_file(file.filename):
            return make_response(
                error=True,
                message=f"Invalid file type for {file.filename}. Allowed: jpg, jpeg, pdf",
                status=400
            )

        # Check file size
        file.seek(0, 2)  # move to end of file
        file_length = file.tell()
        file.seek(0)  # reset pointer to start
        max_size_bytes = MAX_FILE_SIZE_MB * 1024 * 1024

        if file_length > max_size_bytes:
            return make_response(
                error=True,
                message=f"File {file.filename} exceeds maximum size of {MAX_FILE_SIZE_MB} MB",
                status=400
            )

        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_name = f"{uuid.uuid4()}.{ext}"
        s3_key = f"uploads/{unique_name}"

        try:
            s3_client.upload_fileobj(
                file,
                BUCKET_NAME,
                s3_key,
                ExtraArgs={
                    "ContentType": file.content_type
                }
            )
            s3_uri = f"s3://{BUCKET_NAME}/{s3_key}"
            uploaded_map[name] = s3_uri
            uploaded_keys.append(s3_key)

        except ClientError as e:
            # Rollback previously uploaded files
            for uploaded_key in uploaded_keys:
                try:
                    s3_client.delete_object(Bucket=BUCKET_NAME, Key=uploaded_key)
                except ClientError:
                    pass  # ignore rollback failures
            print(str(e))
            return make_response(
                error=True,
                message=f"Failed to upload {file.filename}",
                status=500
            )

    return make_response(
        error=False,
        message="All files uploaded successfully",
        result=uploaded_map,
        status=201
    )




@s3_bp.route("/delete", methods=["DELETE"])
def delete_file():
    """
    Delete a single file from S3 given its public URL.
    Body (JSON):
        { "url": "https://bucket.s3.region.amazonaws.com/uploads/uuid.jpg" }
    Handles:
        - Missing URL
        - Invalid URL format
        - Wrong path (not uploads/)
        - File not found
        - AWS errors
    """
    try:
        data = request.get_json()
        if not data or "url" not in data:
            return make_response(error=True, message="URL is required", status=400)

        file_url = data["url"]

        # Validate URL
        parsed_url = urlparse(file_url)
        if not parsed_url.scheme or not parsed_url.netloc or not parsed_url.path:
            return make_response(error=True, message="Invalid URL format", status=400)

        s3_key = parsed_url.path.lstrip("/")  # removes leading slash

        # Validate bucket path
        if not s3_key.startswith("uploads/"):
            return make_response(error=True, message="Invalid file key or path", status=400)

        # Check file existence in S3
        try:
            s3_client.head_object(Bucket=BUCKET_NAME, Key=s3_key)
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return make_response(error=True, message="File not found", status=404)
            return make_response(error=True, message="Error checking file existence", status=500)

        # Delete the file
        try:
            s3_client.delete_object(Bucket=BUCKET_NAME, Key=s3_key)
            return make_response(
                error=False,
                message=f"File deleted successfully",
                status=200
            )
        except ClientError as e:
            return make_response(error=True, message="Failed to delete file", status=500)

    except Exception as e:
        return make_response(error=True, message=f"Unexpected error: {str(e)}", status=500)





@s3_bp.route("/access", methods=["POST"])
def get_file_url():
    """
    Generates a pre-signed URL for a private S3 object using its S3 URI.

    Expected Body (JSON):
        { "s3_uri": "s3://wethink-storage/uploads/a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890.pdf" }

    Returns:
        A JSON response with a temporary, pre-signed URL.
    """
    try:
        data = request.get_json()
        if not data or "s3_uri" not in data:
            return make_response(error=True, message="S3 URI is required in the request body", status=400)
            
        s3_uri = data["s3_uri"]
        
        parsed_uri = urlparse(s3_uri)
        
        # Validate URI scheme
        if parsed_uri.scheme != "s3":
            return make_response(error=True, message="Invalid URI scheme. Expected 's3'.", status=400)
            
        bucket_name = parsed_uri.netloc
        s3_key = parsed_uri.path.lstrip("/")
        
        # Validate that the URI refers to the correct bucket
        if bucket_name != BUCKET_NAME:
            return make_response(error=True, message="Invalid bucket name in URI.", status=400)
        
        # Optional: Add a check to ensure the key is in the correct path
        if not s3_key.startswith("uploads/"):
            return make_response(error=True, message="Invalid S3 key format or path.", status=400)
        
        # Check if the object exists
        s3_client.head_object(Bucket=bucket_name, Key=s3_key)
        
        # Generate the pre-signed URL
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket_name, "Key": s3_key},
            ExpiresIn=3600  # URL expires in 1 hour
        )
        
        return make_response(
            error=False,
            message="Pre-signed URL generated successfully",
            result={"url": url},
            status=200
        )
        
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return make_response(error=True, message="File not found", status=404)
        return make_response(error=True, message=f"Failed to generate URL: {str(e)}", status=500)
    except Exception as e:
        return make_response(error=True, message=f"Unexpected error: {str(e)}", status=500)