import re
import bcrypt
from flask import jsonify
import datetime as dt

import pytz


def hash_password(plain: str) -> bytes:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12))


def verify_password(plain: str, hashed: bytes) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed)
    except Exception:
        return False




def to_village_card(doc: dict):
    return {
        "villageId": doc.get("village_id"),
        "name": doc.get("name"),
        "currStage": doc.get("current_stage"),
        "lastUpdatedAt": doc.get("updated_at"),
    }

def make_response(error: bool, message: str, result=None, status: int = 200):
    """Helper to standardize API responses"""
    return jsonify({
        "error": error,
        "message": message,
        "result": result
    }), status


from pydantic import ValidationError

def validation_error_response(err: ValidationError, status: int = 400):
    """
    Standardized response for Pydantic ValidationError
    Returns same format as make_response
    """
    details = {}
    for e in err.errors():
        field_path = ".".join(map(str, e["loc"]))
        details[field_path] = e["msg"]

    return make_response(
        True,
        "Validation error",
        result={"details": details},
        status=status
    )
STATUS_TRANSITIONS = {
    "ra": 1,  # range Assistant can transition a plot with status 1 to status 2
    "ro": 2,  # range Officer can transition a plot with status 2 to status 3
    "ad": 3,  # Admin can transition a plot with status 3 to status 4
}


# A regex pattern for validating S3 URLs
s3_url_pattern = re.compile(
    r'^s3://'  # Must start with 's3://'
    r'(?=[a-z0-9])'  # Bucket name must start with a letter or digit
    r'(?!.*--)' # Disallow double hyphens
    r'(?!-)' # Disallow starting with hyphen
    r'(?!.*-/$)' # Disallow ending with hyphen
    r'[a-z0-9][a-z0-9.-]{2,62}[a-z0-9]' # Validate bucket name length and characters
    r'(/.*)?$' # Key part is optional
)
from flask import jsonify

def authorization(decoded_data, userId: str = None):

    user_id = decoded_data.get("userId")
    user_role = decoded_data.get("role")
    activated = bool(decoded_data.get("activated"))

    if not user_id or not user_role:
        return {"error": True, "message": "Invalid token: missing userId or role", "status": 400}
    
    if userId and user_id != userId:
        return {"error": True, "message": "Unauthorized access", "status": 403}

    if not activated:
        return {"error": True, "message": "User is not activated. Contact DD", "status": 400}

    # All checks passed
    return None


def authorizationDD(decoded_data):

    user_id = decoded_data.get("userId")
    user_role = decoded_data.get("role")

    if not user_id or not user_role:
        return {"error": True, "message": "Invalid token: missing userId or role", "status": 400}
    
    if user_role != "dd":
        return {"error": True, "message": "Unauthorized access", "status": 403}

    # All checks passed
    return None


def nowIST():
    """
    Returns the current time in IST as a string "YYYY-MM-DD HH:MM:SS"
    """
    ist = dt.datetime.now(pytz.timezone("Asia/Kolkata"))
    return ist.strftime("%Y-%m-%d %H:%M:%S")

def str_to_ist_datetime(time_str):
    """
    Convert a string "YYYY-MM-DD HH:MM:SS" to a datetime object in IST
    """
    try:
        dt_obj = dt.datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
        dt_obj = dt_obj.replace(tzinfo=pytz.timezone("Asia/Kolkata"))
        return dt_obj
    except Exception as e:
        raise ValueError(f"Invalid time format: {time_str}") from e

def is_time_past(time_str1, time_str2):
    """
    Compare two time strings in IST format.
    Returns True if time_str1 > time_str2
    """
    dt1 = str_to_ist_datetime(time_str1)
    dt2 = str_to_ist_datetime(time_str2)
    return dt1 > dt2