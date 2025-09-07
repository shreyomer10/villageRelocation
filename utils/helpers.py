import bcrypt
from flask import jsonify


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
