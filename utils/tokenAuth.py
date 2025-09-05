


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
        # 1. Try to get the token from the Authorization header (for mobile apps)
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1].strip()
        
        # 2. If not found, try to get it from the 'access_token' cookie (for web clients)
        else:
            token = request.cookies.get("token")

        if not token:
            return jsonify({"error": "Token is missing"}), 401
        
        try:
            # You might need to adjust the JWT_SECRET and algorithms based on your configuration
            claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Access token expired"}), 401
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



