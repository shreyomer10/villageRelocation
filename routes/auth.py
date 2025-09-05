
import datetime as dt

from flask import Flask, Blueprint,request, jsonify,make_response
from config import JWT_EXPIRE_MIN, db
from utils.helpers import verify_password
from utils.tokenAuth import auth_required,make_jwt

users = db.users

auth_bp = Blueprint("auth",__name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    email = (data.get("email")).strip().lower()
    password = data.get("password")
    is_app = data.get('is_app',False)
    if not email or not password :
        return jsonify({"message": "Missing emp_id, roll, password, or mobile_number"}), 400

    user = users.find_one({"email": email})


    if not user or not verify_password(password, user.get("password_hash", b"")):
        return jsonify({"error": "Invalid credentials"}), 401
    token = make_jwt({"sub": str(user.get("_id")), "role": user.get("role"), "name": user.get("name")})
    if is_app:

        return jsonify({
            "error":False,
            "message":"Login Successfull",
            "token": token,
            "user": {"name": user.get("name"), "email": user.get("email"), "role": user.get("role")}
        }),200
    else:
        response = make_response(jsonify({
            "error":False,
            "message": "Login successful",
            "user": {"name": user.get("name"), "email": user.get("email"), "role": user.get("role")}
        }))
        response.set_cookie(
            "token",
            token,
            httponly=True,
            secure=True,
            samesite='None',
            max_age=JWT_EXPIRE_MIN # 2 hours
        )
        return response, 200

@auth_bp.route('/refresh', methods=['POST'])
@auth_required
def refresh_token(decoded_data):
    try:
        new_payload = {
            "sub": decoded_data.get("sub"),
            "roll": decoded_data.get("roll"),
            "name": decoded_data.get("name")
        }
        
        token = make_jwt(new_payload)

        return jsonify({"message": "Token refreshed successfully", "token": token, "employee": decoded_data["employee"]}), 200
    except Exception as e:
        #logging.error(f"Error refreshing token: {e}")
        return jsonify({"error": "Failed to refresh token", "details": str(e)}), 500
