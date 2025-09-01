


import os
import datetime as dt
from functools import wraps

from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient, ASCENDING, DESCENDING
from config import db,JWT_EXPIRE_MIN,JWT_SECRET
from werkzeug.security import gen_salt
import bcrypt
import jwt

def auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing/invalid Authorization header"}), 401
        token = auth.split(" ", 1)[1].strip()
        try:
            claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        request.user = claims
        return fn(*args, **kwargs)
    return wrapper
def make_jwt(payload: dict) -> str:
    exp = dt.datetime.utcnow() + dt.timedelta(minutes=JWT_EXPIRE_MIN)
    payload = {**payload, "exp": exp}
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    # PyJWT>=2 returns str
    return token



