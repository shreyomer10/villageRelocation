
from datetime import datetime as dt, timedelta
from email.mime.text import MIMEText
import random
import smtplib
import bcrypt
from bson import ObjectId
from flask import Flask, Blueprint,request, jsonify
from pydantic import ValidationError
from models.emp import Users
from config import JWT_EXPIRE_MIN, db,OTP_EXPIRE_MIN,RECIEVER_EMAIL,SENDER_EMAIL,APP_PASSWORD
from utils.helpers import hash_password, make_response, verify_password
from utils.tokenAuth import auth_required,make_jwt
from pymongo import errors as mongo_errors
users = db.users
password_history=db.passwords


auth_bp = Blueprint("auth",__name__)



@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.json

        emp_id = data.get('emp_id')
        mobile_number = data.get('mobile_number')
        role = data.get('role')
        raw_password = data.get('password')

        # -------- Validate Required Fields -------- #
        if not emp_id or not mobile_number or not role or not raw_password:
            return jsonify({"error": "Missing emp_id, mobile_number, role, or password"}), 400

        # -------- Find Employee -------- #
        emp_doc = users.find_one(
            {"userId": emp_id, "mobile": mobile_number, "role": role},
            {"_id": 0}
        )
        if not emp_doc:
            return jsonify({"error": "Employee not found. Please contact admin."}), 404
        otp_doc = emp_doc.get("otp")
        if not otp_doc or not otp_doc.get("used") or not otp_doc.get("passed") or dt.utcnow() > otp_doc.get("expiresAt"):
            return jsonify({"error": "OTP verification required"}), 403

        # -------- Check if Already Registered -------- #
        if emp_doc.get("password"):  # password field already exists and not empty
            return jsonify({"error": "Employee already registered. Please login."}), 400

        # -------- Hash and Update Password -------- #
        hashed_password = hash_password(raw_password)

        users.update_one(
            {"userId": emp_id, "mobile": mobile_number, "role": role},
            {"$set": {"password": hashed_password}}
        )

        # -------- Insert Password History -------- #
        password_history.insert_one({
            "userId": emp_id,
            "previous_password": hashed_password,
            "changed_at": dt.utcnow()
        })

        return jsonify({"message": "Registration successful. Please login."}), 200

    except mongo_errors.PyMongoError as e:
        return make_response(True, f"Database error: {str(e)}", status=500)

    except Exception as e:
        return make_response(True,"Unexpected Error Occured",500)
    

@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json(force=True)
        user_agent = request.headers.get("User-Agent", "")
        ip_address = request.headers.get("X-Forwarded-For", request.remote_addr)

        emp_id = data.get("emp_id")
        mobile_number = data.get("mobile_number")
        role = data.get("role")
        raw_password = data.get("password")
        is_app = data.get("is_app", False)

        # -------- Validate Required Fields -------- #
        if not emp_id or not mobile_number or not role or not raw_password:
            return make_response(True, "Missing emp_id, mobile_number, role, or password", status=400)

        # -------- Fetch User from Mongo -------- #
        emp_doc = users.find_one(
            {"userId": emp_id, "mobile": mobile_number, "role": role,"verified":True,"deleted":False},
            {"_id": 0,"otp":0}
        )
        if not emp_doc:
            return make_response(True, "Employee not found", status=404)
        if not emp_doc.get("password"):
            return make_response(True, "Not yet Registered", status=404)

        # -------- Password Check -------- #
        if not verify_password(raw_password, emp_doc.get("password")):
            return make_response(True, "Invalid credentials", status=401)

        # -------- Pydantic Validation -------- #
        #emp_doc.pop("password", None)  # remove before validation
        try:
            user = Users.from_mongo(emp_doc)
        except ValidationError as ve:
            return make_response(True, f"User data validation error: {ve.errors()}", status=500)

        # -------- JWT Creation -------- #
        try:
            token = make_jwt({
                "userId": user.userId,   # use userId, not undefined sub
                "role": user.role,
                "name": user.name,
                "ip": ip_address,
                "ua": user_agent
            })
        except Exception as e:
            return make_response(True, f"JWT creation failed: {str(e)}", status=500)

        # -------- Response -------- #
        user_dict = user.model_dump(mode="json")
        user_dict.pop("password", None)  # remove before sending
        
        if is_app:
            return jsonify({
                "error": False,
                "message": "Login successful",
                "token": token,
                "user": user_dict
            }), 200
        else:
            response = jsonify({
                "error": False,
                "message": "Login successfull",
                "user": user_dict
            }),200
            response.set_cookie(
                "token",
                token,
                httponly=True,
                secure=True,
                samesite="None",
                max_age=JWT_EXPIRE_MIN
            )
            return response, 200

    except mongo_errors.PyMongoError as e:
        return make_response(True, f"Database error: {str(e)}", status=500)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)

@auth_bp.route("/refresh", methods=["POST"])
@auth_required
def refresh_token(decoded_data):
    try:
        user_agent = request.headers.get("User-Agent", "")
        ip_address = request.headers.get("X-Forwarded-For", request.remote_addr)

        # -------- Validate decoded_data -------- #
        user_id = decoded_data.get("userId")
        if not user_id:
            return make_response(True, "Invalid token: missing subject", status=400)

        # -------- Fetch latest user -------- #
        user_doc = users.find_one({"userId": user_id}, {"_id": 0})
        if not user_doc:
            return make_response(True, "User not found", status=404)

        # -------- Remove sensitive fields -------- #
        #user_doc.pop("password", None)

        # -------- Pydantic Validation -------- #
        try:
            user = Users.from_mongo(user_doc)
        except ValidationError as ve:
            return make_response(True, f"User data validation error: {ve.errors()}", status=500)
        
        # -------- Generate New JWT -------- #
        try:
            token = make_jwt({
                "sub": user.userId,
                "role": user.role,
                "name": user.name,
                "ip": ip_address,
                "ua": user_agent
            })
        except Exception as e:
            return make_response(True, f"JWT creation failed: {str(e)}", status=500)
        user_dict = user.model_dump(mode="json")
        user_dict.pop("password", None)  # remove before sending
        
        # -------- Response -------- #
        return make_response(
            False,
            "Token refreshed successfully",
            result={
                "token": token,
                "user": user_dict
            },
            status=200
        )

    except mongo_errors.PyMongoError as e:
        return make_response(True, f"Database error: {str(e)}", status=500)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)

# ---------------- UPDATE PASSWORD (admin-style: identify by emp_id, mobile, role) ---------------- #
@auth_bp.route('/updatePassword', methods=['POST'])
def update_password():
    data = request.get_json(force=True)
    emp_id = data.get('emp_id')
    mobile_number = data.get('mobile_number')
    role = data.get('role')
    raw_password = data.get('password')

    if not emp_id or not mobile_number or not role or not raw_password:
        return make_response({"error": "Missing emp_id, mobile_number, role, or password"}, 400)

    try:
        # Fetch user using userId (emp_id) + mobile + role
        emp_doc = users.find_one({"userId": emp_id, "mobile": mobile_number, "role": role})
        if not emp_doc:
            return make_response({"error": "Employee not found. Please contact admin."}, 404)
        otp_doc = emp_doc.get("otp")
        if not otp_doc or not otp_doc.get("used") or not otp_doc.get("passed") or datetime.utcnow() > otp_doc.get("expiresAt"):
            return jsonify({"error": "OTP verification required"}), 403

        prev_hashes = []

        for row in password_history.find({"userId": emp_id}):
            if row.get("previous_password"):
                prev_hashes.append(row["previous_password"])

        # Check if new password matches any previous password
        for old_h in prev_hashes:
            try:
                if verify_password(raw_password,old_h):
                    return make_response({"error": "New password cannot be the same as any previous passwords."}, 400)

            except Exception:
                # If stored format is unexpected, skip that entry but log in real app
                continue

        # Hash the new password
        new_hashed = hash_password(raw_password)

        # Update password in users collection
        users.update_one(
            {"userId": emp_id, "mobile": mobile_number, "role": role},
            {"$set": {"password": new_hashed}}
        )

        # Store password in password_history (audit)
        password_history.insert_one({
            "userId": emp_id,
            "previous_password": new_hashed,
            "changed_at": dt.utcnow()
        })

        return make_response({"message": "Password updated successfully. Please login."}, 200)

    except mongo_errors.PyMongoError as e:
        return make_response({"error": f"Database error: {str(e)}"}, 500)
    except Exception as e:
        return make_response({"error": f"Unexpected error: {str(e)}"}, 500)

@auth_bp.route("/verify", methods=["POST"])
def verify_employee():
    data = request.json
    required_fields = ['emp_id', 'mobile_number', 'role', 'changePass']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required parameters"}), 400

    empId = data["emp_id"]
    mobile_number = data["mobile_number"]
    role = data["role"]

    changePass = data['changePass']
    if changePass not in ["0", "1"]:
        return jsonify({"error": "Invalid value for changePass"}), 400

    try:
        emp_doc = users.find_one({"mobile": mobile_number, "userId": empId, "role": role})
        if not emp_doc:
            return make_response(True, "Employee not found", status=404)
        if changePass=="0":
            if emp_doc.get("password"):
                return make_response(True,"Already Registered. Login",400)

        # ✅ Update employee to mark verified (using empId instead of _id)
        users.update_one(
            {"userId": empId, "mobile": mobile_number, "role": role},
            {"$set": {"verified": True}}
        )

        return make_response(False, "Verified Successfully", status=200)

    except mongo_errors.PyMongoError as e:
        return make_response(True, f"Database error: {str(e)}", status=500)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)



@auth_bp.route("/sendOtp", methods=["POST"])
def send_otp():
    data = request.get_json(force=True)
    emp_id = data.get("emp_id")
    mobile = data.get("mobile_number")
    role = data.get("role")
    purpose = data.get("purpose", "register")

    emp_doc = users.find_one({"userId": emp_id, "mobile": mobile, "role": role,"deleted":False})
    if not emp_doc:
        return make_response(True, "Employee not found", status=404)

    otp = str(random.randint(100000, 999999))
    expires_at = dt.utcnow() + timedelta(minutes=OTP_EXPIRE_MIN)

    # Overwrite latest OTP in user document
    users.update_one(
        {"userId": emp_id, "mobile": mobile, "role": role},
        {"$set": {"otp": {"code": otp, "used": False, "passed": False, "expiresAt": expires_at}}}
    )

    send_email_otp(RECIEVER_EMAIL,otp=otp,userId=emp_id,name=emp_doc.get("name"),mobile_number=mobile)

    return make_response(False, "OTP sent successfully", status=200)


@auth_bp.route("/verifyOtp", methods=["POST"])
def verify_otp():
    data = request.get_json(force=True)
    emp_id = data.get("emp_Id")
    mobile = data.get("mobile_number")
    role = data.get("role")
    otp = data.get("otp")

    emp_doc = users.find_one({"userId": emp_id, "mobile": mobile, "role": role})
    if not emp_doc or not emp_doc.get("otp"):
        return make_response(True, "OTP not found. Please request a new OTP.", status=404)

    otp_doc = emp_doc["otp"]
    if otp_doc["used"]:
        return make_response(True, "OTP already used. Please request a new OTP.", status=400)

    if dt.utcnow() > otp_doc["expiresAt"]:
        return make_response(True, "OTP expired. Please request a new OTP.", status=400)

    if otp_doc["code"] == otp:
        users.update_one(
            {"userId": emp_id, "mobile": mobile, "role": role},
            {"$set": {"otp.used": True, "otp.passed": True}}
        )
        return make_response(False, "OTP verified successfully", status=200)
    else:
        users.update_one(
            {"userId": emp_id, "mobile": mobile, "role": role},
            {"$set": {"otp.used": True, "otp.passed": False}}
        )
        return make_response(True, "OTP verification failed", status=401)

def send_email_otp(receiver_email, otp, userId, name, mobile_number):
    sender_email = SENDER_EMAIL
    app_password = APP_PASSWORD # Gmail app password
    expires_at = (dt.utcnow() + timedelta(minutes=OTP_EXPIRE_MIN)).strftime("%Y-%m-%d %H:%M:%S UTC")

    msg_body = f"""
    Dear {name},

    Your OTP for MAATI is: {otp}
    User ID: {userId}
    Mobile Number: {mobile_number}
    OTP Expiration Time: {expires_at}

    Please do not share this OTP with anyone. It is valid for {OTP_EXPIRE_MIN} minutes only.
    """

    msg = MIMEText(msg_body)
    msg["Subject"] = "OTP for MAATI"
    msg["From"] = sender_email
    msg["To"] = receiver_email

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender_email, app_password)
        server.sendmail(sender_email, receiver_email, msg.as_string())
