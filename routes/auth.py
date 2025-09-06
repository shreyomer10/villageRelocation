
import datetime as dt
from bson import ObjectId
from flask import Flask, Blueprint,request, jsonify,make_response
from models.auth import User
from config import JWT_EXPIRE_MIN, db
from utils.helpers import verify_password
from utils.tokenAuth import auth_required,make_jwt

users = db.users

auth_bp = Blueprint("auth",__name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    role = data.get("role")
    is_app = data.get("is_app", False)

    if not email or not password or not role:
        return jsonify({
            "error": True,
            "message": "Missing email, password, or role",
            "token": None,
            "user": None
        }), 400

    # Fetch user from MongoDB
    user_doc = users.find_one({"email": email})
    if not user_doc or not verify_password(password, user_doc.get("password_hash", b"")):
        return jsonify({
            "error": True,
            "message": "Invalid credentials",
            "token": None,
            "user": None
        }), 401

    # Remove password_hash before sending to Pydantic
    user_doc.pop("password_hash", None)

    # Validate with Pydantic
    user = User.from_mongo(user_doc)

    # Create JWT using sub
    token = make_jwt({"sub": user.sub, "role": user.role, "name": user.name})

    if is_app:
        return jsonify({
            "error": False,
            "message": "Login successful",
            "token": token,
            "user": user.model_dump(mode="json")  # JSON-safe
        }), 200
    else:
        response = make_response(jsonify({
            "error": False,
            "message": "Login successful",
            "user": user.model_dump(mode="json")
        }))
        response.set_cookie(
            "token",
            token,
            httponly=True,
            secure=True,
            samesite='None',
            max_age=JWT_EXPIRE_MIN
        )
        return response, 200

@auth_bp.route('/refresh', methods=['POST'])
@auth_required
def refresh_token(decoded_data):
    try:
        # Fetch latest user from DB
        user_doc = users.find_one({"_id": ObjectId(decoded_data.get("sub"))})
        if not user_doc:
            return jsonify({"error": "User not found"}), 404

        # Remove password_hash if exists
        user_doc.pop("password_hash", None)

        # Validate with Pydantic
        user = User.from_mongo(user_doc)

        # Create new JWT
        new_payload = {
            "sub": user.sub,
            "role": user.role,
            "name": user.name
        }
        token = make_jwt(new_payload)

        return jsonify({
            "message": "Token refreshed successfully",
            "token": token,
            "user": user.model_dump(mode="json")
        }), 200

    except Exception as e:
        return jsonify({
            "error": "Failed to refresh token",
            "details": str(e)
        }), 500
 