# app/utils/rate_limit.py
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask import request
import jwt
from config import REDIS_URL,JWT_SECRET



def get_user_or_ip():
    token = None

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        token = request.cookies.get("token")

    if token:
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            return decoded.get("userId")
        except Exception:
            pass  # fallback to IP

    return get_remote_address()

limiter = Limiter(
    key_func=get_user_or_ip,
    storage_uri=REDIS_URL,
    default_limits=["1000 per day", "200 per hour"])





