
import datetime as dt

from flask import Flask, Blueprint,request, jsonify,make_response
from flask_cors import CORS
from config import JWT_EXPIRE_MIN, db
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
families = db.families

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
                        "description": "Authenticate user and return JWT (mobile) or cookie (web).",
                        "request_sample": {
                            "email": "user@example.com",
                            "password": "securepassword123",
                            "role": "Admin",
                            "is_app": True
                        },
                        "response_sample": {
                            "200_success_app": {
                                "error": False,
                                "message": "Login successful",
                                "token": "<jwt_token>",
                                "user": {
                                    "sub": "68b5b6d9c48a27d901704daf",
                                    "name": "Admin User",
                                    "email": "admin@example.com",
                                    "role": "Admin",
                                    "mobile": "8737861194"
                                }
                            },
                            "200_success_web": {
                                "error": False,
                                "message": "Login successful",
                                "user": { "name": "Admin User", "email": "admin@example.com", "role": "Admin" },
                                "cookies": { "token": "<jwt_token>" }
                            },
                            "400_error": { "error": True, "message": "Missing email, password, or role" },
                            "401_error": { "error": True, "message": "Invalid credentials" }
                        }
                    },
                    {
                        "path": "/refresh",
                        "method": "POST",
                        "description": "Refresh JWT token. Requires valid Authorization Bearer token or cookie.",
                        "request_sample": {
                            "headers": { "Authorization": "Bearer <jwt_token>" }
                        },
                        "response_sample": {
                            "200_success": {
                                "message": "Token refreshed successfully",
                                "token": "<new_jwt_token>",
                                "user": {
                                    "sub": "68b5b6d9c48a27d901704daf",
                                    "name": "Admin User",
                                    "email": "admin@example.com",
                                    "role": "Admin",
                                    "mobile": "8737861194"
                                }
                            },
                            "401_error": { "error": "Invalid or expired token" }
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
                        "description": "Fetch all villages (basic details).",
                        "response_sample": {
                            "200_success": {
                                "error": False,
                                "message": "Successfully Fetched Villages",
                                "result": [
                                    {
                                        "villageId": "V001",
                                        "name": "Village A",
                                        "currentStage": 2,
                                        "currentSubStage": 1,
                                        "updatedAt": "2025-09-06T10:00:00Z"
                                    }
                                ]
                            }
                        }
                    },
                    {
                        "path": "/villages/<village_id>",
                        "method": "GET",
                        "description": "Fetch full details of one village.",
                        "response_sample": {
                            "200_success": {
                                "error": False,
                                "message": "Successfully fetched village",
                                "result": {
                                    "villageId": "V001",
                                    "name": "Village A",
                                    "currentStage": 3,
                                    "siteOfRelocation": "Location X",
                                    "areaDiverted": 450.2,
                                    "image": "http://example.com/img.jpg"
                                }
                            },
                            "404_error": { "error": True, "message": "Not Found" }
                        }
                    },
                    {
                        "path": "/timeline",
                        "method": "GET",
                        "description": "Fetch full relocation stage timeline.",
                        "response_sample": {
                            "200_success": {
                                "error": False,
                                "message": "Successfully Fetched timeline",
                                "result": [
                                    { "stageId": 1, "title": "Survey", "subStages": [] }
                                ]
                            }
                        }
                    },
                    {
                        "path": "/villages/family-count",
                        "method": "GET",
                        "description": "Fetch family counts (total, option1, option2) across all villages.",
                        "response_sample": {
                            "200_success": {
                                "error": False,
                                "message": "Successfully Fetched Count",
                                "result": { "villageId": "All", "total": 150, "option1": 70, "option2": 80 }
                            }
                        }
                    },
                    {
                        "path": "/villages/<village_id>/family-count",
                        "method": "GET",
                        "description": "Fetch family counts for a specific village.",
                        "response_sample": {
                            "200_success": {
                                "error": False,
                                "message": "Successfully Fetched Count",
                                "result": { "villageId": "V001", "total": 50, "option1": 25, "option2": 25 }
                            }
                        }
                    }
                ]
            },
            "family": {
                "prefix": "/family",
                "routes": [
                    {
                        "path": "/villages/<village_id>/beneficiaries",
                        "method": "GET",
                        "description": "Fetch beneficiaries (families) for a given village. Optional query param `option=1|2`.",
                        "response_sample": {
                            "200_success": {
                                "error": False,
                                "message": "Beneficiaries fetched Successfully",
                                "result": [
                                    {
                                        "familyId": "F001",
                                        "mukhiyaName": "Ram Lal",
                                        "relocationOption": 1,
                                        "mukhiyaPhoto": "http://example.com/photo.jpg"
                                    }
                                ]
                            }
                        }
                    },
                    {
                        "path": "/families/<family_id>",
                        "method": "GET",
                        "description": "Fetch detailed information for one family.",
                        "response_sample": {
                            "200_success": {
                                "error": False,
                                "message": "Fetched Successfully",
                                "result": {
                                    "familyId": "F001",
                                    "mukhiyaName": "Ram Lal",
                                    "members": [
                                        { "name": "Shyam", "age": 12 },
                                        { "name": "Geeta", "age": 35 }
                                    ],
                                    "relocationOption": 1
                                }
                            },
                            "404_error": { "error": "Family not found" }
                        }
                    }
                ]
            }
        }
    }
    return jsonify(api_docs)



if __name__ == "__main__":
    app.run(debug=True)

