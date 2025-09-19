
import datetime as dt
from bson import ObjectId
from flask import Flask, Blueprint,request, jsonify,make_response
from models.auth import User
from config import JWT_EXPIRE_MIN, db
from utils.helpers import verify_password
from utils.tokenAuth import auth_required,make_jwt

users = db.users
operators = db.operators

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
 

# import datetime as dt
# from bson import ObjectId
# from flask import Blueprint, request, jsonify, make_response
# from models.auth import employees
# from config import db, JWT_EXPIRE_MIN, SECRET_KEY
# from utils.helpers import verify_password, hash_password
# from utils.tokenAuth import token_required, make_jwt
# from pydantic import ValidationError
# import bcrypt
# import jwt

# auth_bp = Blueprint("auth", __name__)
# users = db.users   # <-- MongoDB collection

# # ---------------- REGISTER ---------------- #
# @auth_bp.route("/register", methods=["POST"])
# def register():
#     data = request.json
#     email = (data.get("email") or "").lower().strip()
#     mobile = data.get("mobile")
#     role = data.get("role")
#     name = data.get("name")
#     raw_password = data.get("password")


#     if not email or not mobile or not role or not raw_password:
#         return jsonify({"error": "Missing required fields"}), 400

#     # Check if already exists
#     if users.find_one({"email": email}):
#         return jsonify({"error": "Employee already registered. Please login."}), 400

#     hashed_password = hash_password(raw_password)

#     doc = {
#         "email": email,
#         "name": name,
#         "role": role,
#         "mobile": mobile,
#         "password_hash": hashed_password,
#         "access": "RWU",  # default
#         "created_at": dt.datetime.utcnow()
#     }

#     res = users.insert_one(doc)
#     doc["_id"] = str(res.inserted_id)
#     doc.pop("password_hash")

#     return jsonify({"message": "Registration successful", "employee": doc}), 201


# # ---------------- LOGIN ---------------- #
# @auth_bp.route("/login", methods=["POST"])
# def login():
#     data = request.json
#     email = (data.get("email") or "").lower().strip()
#     raw_password = data.get("password")
#     is_app = data.get("is_app", False)

#     if not email or not raw_password:
#         return jsonify({"message": "Missing email or password"}), 400

#     emp_doc = users.find_one({"email": email})
#     if not emp_doc:
#         return jsonify({"message": "Employee not found"}), 404

#     if not verify_password(raw_password, emp_doc.get("password_hash", b"")):
#         return jsonify({"message": "Incorrect password"}), 401

#     emp_doc.pop("password_hash", None)
#     emp = employees.from_mongo(emp_doc)

#     token_payload = {
#         "sub": emp.sub,
#         "role": emp.role,
#         "name": emp.name,
#         "exp": dt.datetime.utcnow() + dt.timedelta(minutes=JWT_EXPIRE_MIN)
#     }
#     token = jwt.encode(token_payload, SECRET_KEY, algorithm="HS256")

#     if is_app:
#         return jsonify({
#             "message": "Login successful",
#             "token": token,
#             "employee": emp.model_dump(mode="json")
#         }), 200
#     else:
#         response = make_response(jsonify({
#             "message": "Login successful",
#             "employee": emp.model_dump(mode="json")
#         }))
#         response.set_cookie(
#             "tokenId", token,
#             httponly=True,
#             secure=True,
#             samesite="None",
#             max_age=JWT_EXPIRE_MIN * 60
#         )
#         return response, 200


# # ---------------- CHANGE PASSWORD ---------------- #
# @auth_bp.route("/changePassword", methods=["POST"])
# @token_required
# def change_password(decoded_data):
#     data = request.json
#     old_password = data.get("old_password")
#     new_password = data.get("new_password")

#     if not old_password or not new_password:
#         return jsonify({"error": "Missing old or new password"}), 400

#     emp_id = decoded_data["sub"]
#     emp_doc = users.find_one({"_id": ObjectId(emp_id)})

#     if not emp_doc:
#         return jsonify({"error": "Employee not found"}), 404

#     if not verify_password(old_password, emp_doc.get("password_hash", b"")):
#         return jsonify({"error": "Old password is incorrect"}), 401

#     hashed_new = hash_password(new_password)
#     users.update_one(
#         {"_id": ObjectId(emp_id)},
#         {"$set": {"password_hash": hashed_new}}
#     )

#     return jsonify({"message": "Password updated successfully"}), 200


# # ---------------- VERIFY EMPLOYEE ---------------- #
# @auth_bp.route("/verify", methods=["POST"])
# def verify_employee():
#     data = request.json
#     email = (data.get("email") or "").lower().strip()
#     mobile = data.get("mobile")

#     if not email or not mobile:
#         return jsonify({"error": "Missing email or mobile"}), 400

#     emp_doc = users.find_one({"email": email, "mobile": mobile})
#     if not emp_doc:
#         return jsonify({"message": "Employee not found"}), 404

#     return jsonify({"message": "Verified"}), 200


# # ---------------- REFRESH TOKEN ---------------- #
# @auth_bp.route("/refresh", methods=["POST"])
# @token_required
# def refresh_token(decoded_data):
#     try:
#         emp_doc = users.find_one({"_id": ObjectId(decoded_data.get("sub"))})
#         if not emp_doc:
#             return jsonify({"error": "Employee not found"}), 404

#         emp_doc.pop("password_hash", None)
#         emp = employees.from_mongo(emp_doc)

#         new_payload = {
#             "sub": emp.sub,
#             "role": emp.role,
#             "name": emp.name,
#             "exp": dt.datetime.utcnow() + dt.timedelta(minutes=JWT_EXPIRE_MIN)
#         }
#         new_token = jwt.encode(new_payload, SECRET_KEY, algorithm="HS256")

#         return jsonify({
#             "message": "Token refreshed successfully",
#             "token": new_token,
#             "employee": emp.model_dump(mode="json")
#         }), 200
#     except Exception as e:
#         return jsonify({"error": "Failed to refresh token", "details": str(e)}), 500
