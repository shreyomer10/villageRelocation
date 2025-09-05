
import datetime as dt

from flask import Flask, Blueprint,request, jsonify,make_response
from flask_cors import CORS
from pymongo import  ASCENDING, DESCENDING
from config import JWT_EXPIRE_MIN, db
import jwt
from utils.helpers import hash_password,verify_password,to_village_card
from utils.tokenAuth import auth_required,make_jwt
from routes.auth import auth_bp
from routes.village import village_bp
from routes.family import family_bp


app = Flask(__name__)
CORS(app,
     supports_credentials=True,
     resources={
         r"/*": {
             "origins": [
                 "http://localhost:5173",
                 "https://villagerelocation-kkot.onrender.com"
             ]
         }
     })




users = db.users
villages = db.villages
stages = db.stages
village_stage_progress = db.village_stage_progress
families = db.families
family_members = db.family_members
option1_housing = db.option1_housing
option2_fundflow = db.option2_fundflow
plan_layouts = db.plan_layouts

app.register_blueprint(auth_bp,url_prefix="/")
app.register_blueprint(village_bp,url_prefix="/")
app.register_blueprint(family_bp,url_prefix="/")

@app.route("/", methods=["GET"])
def home():
    api_docs = {
        "api_documentation": {
            "auth": {
                "prefix": "/auth",
                "routes": [
                    {
                        "path": "/login",
                        "method": "POST",
                        "description": "Authenticates a user and returns a JWT token.",
                        "request_sample": {
                            "email": "user@example.com",
                            "password": "securepassword123",
                            "is_app": True
                        },
                        "response_sample": {
                            "200_app_success": {
                                "error": False,
                                "message": "Login Successfull",
                                "token": "eyJhbGciOiJIUzI1NiIsInR5c...<jwt_token>...jS8l7_B_h4w1K9c",
                                "user": {
                                    "name": "John Doe",
                                    "email": "user@example.com",
                                    "role": "admin"
                                }
                            },
                            "200_web_success": {
                                "error": False,
                                "message": "Login successful",
                                "user": {
                                    "name": "John Doe",
                                    "email": "user@example.com",
                                    "role": "admin"
                                },
                                "cookies": {
                                    "token": "eyJhbGciOiJIUzI1NiIsInR5c...<jwt_token>...jS8l7_B_h4w1K9c"
                                }
                            },
                            "400_missing_credentials": {
                                "message": "Missing emp_id, roll, password, or mobile_number"
                            },
                            "401_invalid_credentials": {
                                "error": "Invalid credentials"
                            }
                        }
                    },
                    {
                        "path": "/refresh",
                        "method": "POST",
                        "description": "Refreshes an expired access token using a valid refresh token. This endpoint requires an existing access token to be passed in the Authorization header via the `auth_required` decorator.",
                        "request_sample": None,
                        "response_sample": {
                            "200_success": {
                                "message": "Token refreshed successfully",
                                "token": "eyJhbGciOiJIUzI1NiIsInR5c...<new_jwt_token>...jS8l7_B_h4w1K9c",
                                "employee": {
                                    "name": "John Doe",
                                    "email": "user@example.com",
                                    "role": "admin"
                                }
                            },
                            "401_invalid_token": {
                                "error": "Invalid token"
                            }
                        }
                    }
                ]
            },
            "village": {
                "prefix": "/village",
                "routes": [
                    {
                        "path": "/villages",
                        "method": "GET",
                        "description": "Gets a list of all villages. Can be filtered by a stage number or a comma-separated list of stages.",
                        "request_sample": None,
                        "query_parameters": {
                            "stage": "2"
                        },
                        "response_sample": {
                            "200_success": [
                                {
                                    "villageId": "V001",
                                    "name": "Village A",
                                    "currentStage": 3,
                                    "updatedAt": "2023-10-27T10:00:00Z"
                                }
                            ]
                        }
                    },
                    {
                        "path": "/villages/<village_id>",
                        "method": "GET",
                        "description": "Retrieves detailed information about a specific village.",
                        "request_sample": None,
                        "path_parameters": {
                            "village_id": "V001"
                        },
                        "response_sample": {
                            "200_success": {
                                "villageId": "V001",
                                "name": "Village A",
                                "currentStage": 3,
                                "totalStages": 5,
                                "lastUpdatedOn": "2023-10-27T10:00:00Z",
                                "location": {
                                    "latitude": 21.1702,
                                    "longitude": 72.8311
                                },
                                "areaOfRelocation": 500.5,
                                "areaDiverted": 450.2,
                                "image": "path/to/image.jpg"
                            },
                            "404_not_found": {
                                "error": "Village not found"
                            }
                        }
                    }
                ]
            }
            # ... (add other sections from your JSON structure here)
        }
    }
    
    return jsonify(api_docs)

# ----------------------------------------------------------------------------
# Bootstrap utility: create an initial admin and sample data (optional)
# ----------------------------------------------------------------------------
@app.route("/dev/bootstrap", methods=["POST"])
def bootstrap_seed():
    # """Seed minimal sample data. Protect/remove in production!"""
    # if os.getenv("FLASK_ENV") != "development":
    #     return jsonify({"error": "Not allowed in production"}), 403

    # Idempotent inserts
    users.update_one(
        {"email": "admin@example.com"},
        {"$setOnInsert": {
            "name": "Admin User",
            "email": "admin@example.com",
            "role": "Admin",
            "password_hash": hash_password("Admin@123")
        }},
        upsert=True,
    )

    # Stages (example 5)
    stage_defs = [
        {"stage_id": 1, "name": "Gram Sabha Meeting", "description": "Initial consent", "sequence_no": 1},
        {"stage_id": 2, "name": "Consent Collection", "description": "Collect family consent", "sequence_no": 2},
        {"stage_id": 3, "name": "Land Identification", "description": "Identify land", "sequence_no": 3},
        {"stage_id": 4, "name": "Compensation Approval", "description": "Approve funds", "sequence_no": 4},
        {"stage_id": 5, "name": "Relocation Completed", "description": "Handover", "sequence_no": 5},
    ]
    for s in stage_defs:
        stages.update_one({"stage_id": s["stage_id"]}, {"$setOnInsert": s}, upsert=True)

    # Village sample
    v = {
        "village_id": "TILAIDABRA",
        "name": "Tilaidabra",
        "current_stage": 2,
        "total_stages": 5,
        "location_latitude": 20.123456,
        "location_longitude": 81.234567,
        "area_of_relocation": 150.5,
        "area_diverted": 120.0,
        "photo": "https://example.com/images/tila.jpg",
        "created_at": dt.datetime.utcnow(),
        "updated_at": dt.datetime.utcnow(),
    }
    villages.update_one({"village_id": v["village_id"]}, {"$set": v}, upsert=True)

    # Families
    fam1 = {
        "family_id": "FAM-001",
        "village_id": "TILAIDABRA",
        "mukhiyaId": "A1234",
        "mukhiyaName": "Ramesh Kumar",
        "mukhiya_photo": "https://example.com/families/fam001.jpg",
        "relocation_option": 1,
        "created_at": dt.datetime.utcnow(),
        "updated_at": dt.datetime.utcnow(),
    }
    fam2 = {
        "family_id": "FAM-002",
        "village_id": "TILAIDABRA",
        "mukhiyaId": "B9876",
        "mukhiyaName": "Sita Devi",
        "mukhiya_photo": "https://example.com/families/fam002.jpg",
        "relocation_option": 2,
        "created_at": dt.datetime.utcnow(),
        "updated_at": dt.datetime.utcnow(),
    }
    families.update_one({"family_id": fam1["family_id"]}, {"$set": fam1}, upsert=True)
    families.update_one({"family_id": fam2["family_id"]}, {"$set": fam2}, upsert=True)

    # Family members
    family_members.update_one({"member_id": "M-001-1"}, {"$set": {
        "member_id": "M-001-1", "family_id": "FAM-001", "name": "Ramesh Kumar", "age": 42, "health_status": "Good", "photo": "https://example.com/members/m0011.jpg"
    }}, upsert=True)
    family_members.update_one({"member_id": "M-001-2"}, {"$set": {
        "member_id": "M-001-2", "family_id": "FAM-001", "name": "Sunita Kumari", "age": 39, "health_status": "Good", "photo": "https://example.com/members/m0012.jpg"
    }}, upsert=True)

    family_members.update_one({"member_id": "M-002-1"}, {"$set": {
        "member_id": "M-002-1", "family_id": "FAM-002", "name": "Sita Devi", "age": 45, "health_status": "Diabetic", "photo": "https://example.com/members/m0021.jpg"
    }}, upsert=True)

    # Option1 housing photos
    option1_housing.update_one({"id": "O1-001-1"}, {"$set": {
        "id": "O1-001-1", "family_id": "FAM-001", "geo_lat": 20.1235, "geo_long": 81.2346, "photo_url": "https://example.com/o1/fam001_1.jpg", "progress_note": "Foundation complete", "uploaded_on": dt.datetime.utcnow()
    }}, upsert=True)

    # Option2 fund flow stages
    o2_items = [
        {"id": "O2-002-1", "family_id": "FAM-002", "stage": "Allocated to Collector", "amount": 1500000, "status": "Completed", "transaction_date": dt.datetime.utcnow(), "proof_document": "https://example.com/docs/alloc.pdf"},
        {"id": "O2-002-2", "family_id": "FAM-002", "stage": "Collector + Beneficiary Joint Account", "amount": 0, "status": "Completed", "transaction_date": dt.datetime.utcnow(), "proof_document": "https://example.com/docs/joint.pdf"},
        {"id": "O2-002-3", "family_id": "FAM-002", "stage": "Disbursed Stage 1 (5L)", "amount": 500000, "status": "Completed", "transaction_date": dt.datetime.utcnow(), "proof_document": "https://example.com/docs/stage1.pdf"},
        {"id": "O2-002-4", "family_id": "FAM-002", "stage": "Disbursed Stage 2 (4.5L)", "amount": 450000, "status": "Pending", "transaction_date": None, "proof_document": None},
        {"id": "O2-002-5", "family_id": "FAM-002", "stage": "Disbursed Stage 3 (5.5L)", "amount": 550000, "status": "Pending", "transaction_date": None, "proof_document": None},
    ]
    for it in o2_items:
        option2_fundflow.update_one({"id": it["id"]}, {"$set": it}, upsert=True)

    return jsonify({"ok": True})



if __name__ == "__main__":
    app.run(debug=True)

