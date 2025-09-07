
import datetime as dt

from flask import Flask, Blueprint,request, jsonify,make_response
from flask_cors import CORS
from config import JWT_EXPIRE_MIN, db
from routes.auth import auth_bp
from routes.village import village_bp
from routes.family import family_bp
from routes.maati import maati_bp


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
core = db.core

app.register_blueprint(auth_bp,url_prefix="/")
app.register_blueprint(village_bp,url_prefix="/")
app.register_blueprint(family_bp,url_prefix="/")
app.register_blueprint(maati_bp,url_prefix="/")




@app.route("/", methods=["GET"])
def home():
    """
    Village Relocation Management System API Documentation
    Complete API reference with all endpoints, parameters, and responses
    """
    
    api_docs = {
        "project_name": "Village Relocation Management System",
        "version": "1.0.0",
        "base_url": "http://your-domain.com/api/v1",
        "description": "API for managing village relocation processes, families, and administrative tasks",
        "api_documentation": {
            
            # ================================
            # AUTHENTICATION ENDPOINTS
            # ================================
            "auth": {
                "prefix": "/auth",
                "description": "Authentication and authorization endpoints",
                "routes": [
                    {
                        "path": "/login",
                        "method": "POST",
                        "description": "Authenticate user and return JWT token (mobile) or set cookie (web)",
                        "content_type": "application/json",
                        "request_sample": {
                            "email": "admin@example.com",
                            "password": "securepassword123",
                            "role": "Admin",
                            "is_app": True  # True for mobile app, False for web
                        },
                        "response_samples": {
                            "200_success_mobile": {
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
                                "user": {
                                    "name": "Admin User",
                                    "email": "admin@example.com",
                                    "role": "Admin"
                                },
                                "cookies": {
                                    "token": "<jwt_token>"
                                }
                            },
                            "400_bad_request": {
                                "error": True,
                                "message": "Missing email, password, or role",
                                "token": None,
                                "user": None
                            },
                            "401_unauthorized": {
                                "error": True,
                                "message": "Invalid credentials",
                                "token": None,
                                "user": None
                            }
                        }
                    },
                    {
                        "path": "/refresh",
                        "method": "POST",
                        "description": "Refresh JWT token using existing valid token",
                        "authorization_required": True,
                        "headers": {
                            "Authorization": "Bearer <jwt_token>",
                            "Content-Type": "application/json"
                        },
                        "response_samples": {
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
                            "404_user_not_found": {
                                "error": "User not found"
                            },
                            "500_refresh_failed": {
                                "error": "Failed to refresh token",
                                "details": "<error_details>"
                            }
                        }
                    }
                ]
            },
            
            # ================================
            # VILLAGE MANAGEMENT ENDPOINTS
            # ================================
            "village": {
                "prefix": "/village",
                "description": "Village management and information endpoints",
                "routes": [
                    {
                        "path": "/villages",
                        "method": "GET",
                        "description": "Fetch all villages with basic details (card view)",
                        "parameters": "None",
                        "response_samples": {
                            "200_success": {
                                "error": False,
                                "message": "Successfully Fetched Villages",
                                "result": [
                                    {
                                        "villageId": "V001",
                                        "name": "Village Alpha",
                                        "currentStage": 3,
                                        "currentSubStage": 2,
                                        "updatedAt": "2025-09-06T10:00:00Z",
                                        "updatedBy": "Admin User",
                                        "siteOfRelocation": "Location Alpha Site",
                                        "areaDiverted": 450.75
                                    },
                                    {
                                        "villageId": "V002", 
                                        "name": "Village Beta",
                                        "currentStage": 2,
                                        "currentSubStage": 1,
                                        "updatedAt": "2025-09-05T14:30:00Z",
                                        "updatedBy": "Field Officer",
                                        "siteOfRelocation": "Location Beta Site",
                                        "areaDiverted": 325.50
                                    }
                                ]
                            },
                            "500_server_error": {
                                "error": True,
                                "message": "<error_details>",
                                "result": None
                            }
                        }
                    },
                    {
                        "path": "/villages/<village_id>",
                        "method": "GET",
                        "description": "Fetch complete details of a specific village",
                        "parameters": {
                            "village_id": "string (path parameter) - Unique village identifier"
                        },
                        "response_samples": {
                            "200_success": {
                                "error": False,
                                "message": "Successfully fetched village",
                                "result": {
                                    "villageId": "V001",
                                    "name": "Village Alpha",
                                    "currentStage": 3,
                                    "currentSubStage": 2,
                                    "siteOfRelocation": "Location Alpha Site",
                                    "areaDiverted": 450.75,
                                    "image": "http://example.com/villages/v001.jpg",
                                    "updatedAt": "2025-09-06T10:00:00Z",
                                    "updatedBy": "Admin User",
                                    "description": "Village description here",
                                    "totalFamilies": 125,
                                    "coordinates": {
                                        "latitude": 23.4567,
                                        "longitude": 78.9012
                                    }
                                }
                            },
                            "404_not_found": {
                                "error": True,
                                "message": "Not Found",
                                "result": None
                            },
                            "500_validation_error": {
                                "error": True,
                                "message": "Invalid village data: <validation_error>",
                                "result": None
                            }
                        }
                    },
                    {
                        "path": "/timeline",
                        "method": "GET", 
                        "description": "Fetch complete relocation stage timeline with all stages and sub-stages",
                        "parameters": "None",
                        "response_samples": {
                            "200_success": {
                                "error": False,
                                "message": "Successfully Fetched timeline",
                                "result": [
                                    {
                                        "stageId": 1,
                                        "title": "Initial Survey",
                                        "description": "Preliminary assessment and documentation",
                                        "subStages": [
                                            {
                                                "subStageId": 1,
                                                "title": "Land Survey",
                                                "description": "Geographic and topographic survey"
                                            },
                                            {
                                                "subStageId": 2,
                                                "title": "Family Census",
                                                "description": "Count and document all families"
                                            }
                                        ]
                                    },
                                    {
                                        "stageId": 2,
                                        "title": "Planning & Approval",
                                        "description": "Development of relocation plan",
                                        "subStages": [
                                            {
                                                "subStageId": 1,
                                                "title": "Site Selection",
                                                "description": "Choose suitable relocation sites"
                                            }
                                        ]
                                    }
                                ]
                            },
                            "500_server_error": {
                                "error": True,
                                "message": "<error_details>",
                                "result": None
                            }
                        }
                    },
                    {
                        "path": "/villages/family-count",
                        "method": "GET",
                        "description": "Get aggregated family counts across all villages (total, option1, option2)",
                        "parameters": "None",
                        "response_samples": {
                            "200_success": {
                                "error": False,
                                "message": "Successfully Fetched Count",
                                "result": {
                                    "villageId": "All",
                                    "total": 450,
                                    "option1": 220,
                                    "option2": 230
                                }
                            },
                            "500_server_error": {
                                "error": True,
                                "message": "<error_details>",
                                "result": None
                            }
                        }
                    },
                    {
                        "path": "/villages/<village_id>/family-count",
                        "method": "GET",
                        "description": "Get family counts for a specific village (total, option1, option2)",
                        "parameters": {
                            "village_id": "string (path parameter) - Unique village identifier"
                        },
                        "response_samples": {
                            "200_success": {
                                "error": False,
                                "message": "Successfully Fetched Count",
                                "result": {
                                    "villageId": "V001",
                                    "total": 125,
                                    "option1": 65,
                                    "option2": 60
                                }
                            },
                            "500_server_error": {
                                "error": True,
                                "message": "<error_details>",
                                "result": None
                            }
                        }
                    }
                ]
            },
            
            # ================================
            # FAMILY MANAGEMENT ENDPOINTS
            # ================================
            "family": {
                "prefix": "/family",
                "description": "Family and beneficiary management endpoints",
                "routes": [
                    {
                        "path": "/villages/<village_id>/beneficiaries",
                        "method": "GET",
                        "description": "Fetch all beneficiaries (families) for a specific village with optional filtering",
                        "parameters": {
                            "village_id": "string (path parameter) - Unique village identifier",
                            "option": "string (query parameter, optional) - Filter by relocation option ('1' or '2')"
                        },
                        "query_parameters": {
                            "option": "1 | 2 - Filter families by relocation option"
                        },
                        "example_urls": [
                            "/family/villages/V001/beneficiaries",
                            "/family/villages/V001/beneficiaries?option=1",
                            "/family/villages/V001/beneficiaries?option=2"
                        ],
                        "response_samples": {
                            "200_success": {
                                "error": False,
                                "message": "benifeceries fetched Successfully",
                                "result": [
                                    {
                                        "familyId": "F001",
                                        "mukhiyaName": "Ram Lal Singh",
                                        "mukhiyaPhoto": "http://example.com/photos/ramlal.jpg",
                                        "relocationOption": 1
                                    },
                                    {
                                        "familyId": "F002",
                                        "mukhiyaName": "Sita Devi",
                                        "mukhiyaPhoto": "http://example.com/photos/sitadevi.jpg", 
                                        "relocationOption": 2
                                    },
                                    {
                                        "familyId": "F003",
                                        "mukhiyaName": "Mohan Kumar",
                                        "mukhiyaPhoto": "http://example.com/photos/mohankumar.jpg",
                                        "relocationOption": 1
                                    }
                                ]
                            },
                            "500_server_error": {
                                "error": True,
                                "message": "<error_details>",
                                "result": None
                            }
                        }
                    },
                    {
                        "path": "/families/<family_id>",
                        "method": "GET",
                        "description": "Fetch complete detailed information for a specific family",
                        "parameters": {
                            "family_id": "string (path parameter) - Unique family identifier"
                        },
                        "response_samples": {
                            "200_success": {
                                "error": False,
                                "message": "Fetched Successfully",
                                "result": {
                                    "familyId": "F001",
                                    "villageId": "V001",
                                    "mukhiyaName": "Ram Lal Singh",
                                    "mukhiyaAge": 45,
                                    "mukhiyaPhoto": "http://example.com/photos/ramlal.jpg",
                                    "relocationOption": 1,
                                    "contactNumber": "9876543210",
                                    "address": "House No. 123, Village Alpha",
                                    "landOwnership": "5.5 acres",
                                    "members": [
                                        {
                                            "name": "Shyam Singh",
                                            "age": 22,
                                            "relation": "Son",
                                            "occupation": "Student"
                                        },
                                        {
                                            "name": "Geeta Singh",
                                            "age": 40,
                                            "relation": "Wife",
                                            "occupation": "Housewife"
                                        },
                                        {
                                            "name": "Ravi Singh",
                                            "age": 18,
                                            "relation": "Son",
                                            "occupation": "Student"
                                        }
                                    ],
                                    "totalMembers": 4,
                                    "compensationDetails": {
                                        "landCompensation": 275000,
                                        "structureCompensation": 125000,
                                        "totalCompensation": 400000
                                    },
                                    "documentsSubmitted": [
                                        "Aadhaar Card",
                                        "Land Records",
                                        "Bank Details"
                                    ],
                                    "createdAt": "2025-08-15T09:30:00Z",
                                    "updatedAt": "2025-09-01T16:45:00Z"
                                }
                            },
                            "404_not_found": {
                                "error": "Family not found"
                            },
                            "422_validation_error": {
                                "error": True,
                                "message": "<validation_error_details>",
                                "result": None
                            },
                            "500_server_error": {
                                "error": True,
                                "message": "<error_details>",
                                "result": None
                            }
                        }
                    }
                ]
            },
            
            # ================================
            # CORE INFORMATION ENDPOINTS
            # ================================
            "maati": {
                "prefix": "/maati",
                "description": "Core information and content management endpoints",
                "routes": [
                    {
                        "path": "/guidelines",
                        "method": "GET",
                        "description": "Fetch relocation guidelines and procedures",
                        "parameters": "None",
                        "response_samples": {
                            "200_success": {
                                "error": False,
                                "message": "Guidelines fetched successfully",
                                "result": {
                                    "_id": "guidelines",
                                    "title": "Village Relocation Guidelines",
                                    "content": "Detailed guidelines content here...",
                                    "sections": [
                                        {
                                            "title": "Eligibility Criteria",
                                            "content": "Eligibility requirements..."
                                        },
                                        {
                                            "title": "Compensation Process",
                                            "content": "Compensation calculation process..."
                                        }
                                    ],
                                    "lastUpdated": "2025-08-20T10:00:00Z",
                                    "version": "2.1"
                                }
                            },
                            "404_not_found": {
                                "error": True,
                                "message": "Guidelines not found",
                                "result": None
                            },
                            "422_validation_error": {
                                "error": True,
                                "message": "Validation error",
                                "result": ["<validation_error_details>"]
                            },
                            "500_server_error": {
                                "error": True,
                                "message": "Unexpected error: <error_details>",
                                "result": None
                            }
                        }
                    },
                    {
                        "path": "/aboutUs",
                        "method": "GET",
                        "description": "Fetch about us information and organization details",
                        "parameters": "None",
                        "response_samples": {
                            "200_success": {
                                "error": False,
                                "message": "About Us fetched successfully",
                                "result": {
                                    "_id": "aboutUs",
                                    "organizationName": "Village Relocation Authority",
                                    "mission": "To ensure smooth and fair relocation of affected villages",
                                    "vision": "Creating better living conditions through planned relocation",
                                    "history": "Established in 2020 to manage large-scale development projects...",
                                    "team": [
                                        {
                                            "name": "Dr. Rajesh Kumar",
                                            "designation": "Project Director",
                                            "photo": "http://example.com/team/rajesh.jpg"
                                        }
                                    ],
                                    "achievements": [
                                        "Successfully relocated 25 villages",
                                        "100% compensation disbursed",
                                        "Zero displacement conflicts"
                                    ],
                                    "lastUpdated": "2025-08-15T12:00:00Z"
                                }
                            },
                            "404_not_found": {
                                "error": True,
                                "message": "About Us not found",
                                "result": None
                            }
                        }
                    },
                    {
                        "path": "/contactUs",
                        "method": "GET",
                        "description": "Fetch contact information and office details",
                        "parameters": "None",
                        "response_samples": {
                            "200_success": {
                                "error": False,
                                "message": "Contact Us fetched successfully",
                                "result": {
                                    "_id": "contactUs",
                                    "headquarters": {
                                        "address": "Village Relocation Authority, Central Office, New Delhi - 110001",
                                        "phone": "+91-11-23456789",
                                        "email": "info@villagerelocation.gov.in",
                                        "fax": "+91-11-23456790"
                                    },
                                    "regionalOffices": [
                                        {
                                            "region": "North Zone",
                                            "address": "Regional Office North, Chandigarh - 160001",
                                            "phone": "+91-172-2345678",
                                            "email": "north@villagerelocation.gov.in"
                                        },
                                        {
                                            "region": "South Zone", 
                                            "address": "Regional Office South, Bangalore - 560001",
                                            "phone": "+91-80-23456789",
                                            "email": "south@villagerelocation.gov.in"
                                        }
                                    ],
                                    "emergencyContact": {
                                        "number": "1800-123-4567",
                                        "description": "24x7 Helpline for urgent relocation issues"
                                    },
                                    "socialMedia": {
                                        "website": "https://www.villagerelocation.gov.in",
                                        "twitter": "@VillageRelocGov",
                                        "facebook": "VillageRelocationAuthority"
                                    },
                                    "workingHours": "Monday to Friday: 9:00 AM - 6:00 PM",
                                    "lastUpdated": "2025-09-01T08:00:00Z"
                                }
                            },
                            "404_not_found": {
                                "error": True,
                                "message": "Contact Us not found",
                                "result": None
                            }
                        }
                    },
                    {
                        "path": "/faq",
                        "method": "GET",
                        "description": "Fetch frequently asked questions about relocation process",
                        "parameters": "None",
                        "response_samples": {
                            "200_success": {
                                "error": False,
                                "message": "FAQ fetched successfully",
                                "result": {
                                    "_id": "faq",
                                    "title": "Frequently Asked Questions - Village Relocation",
                                    "categories": [
                                        {
                                            "categoryName": "General Information",
                                            "questions": [
                                                {
                                                    "question": "What is the village relocation program?",
                                                    "answer": "The village relocation program is a government initiative to relocate villages affected by development projects while ensuring fair compensation and better living conditions."
                                                },
                                                {
                                                    "question": "Who is eligible for relocation?",
                                                    "answer": "All families residing in the affected villages as per the baseline survey are eligible for relocation benefits."
                                                }
                                            ]
                                        },
                                        {
                                            "categoryName": "Compensation",
                                            "questions": [
                                                {
                                                    "question": "How is compensation calculated?",
                                                    "answer": "Compensation is calculated based on land area, structure value, crop loss, and other assets as per government guidelines."
                                                },
                                                {
                                                    "question": "When will compensation be paid?",
                                                    "answer": "Compensation is paid in phases - advance payment, interim payment, and final settlement as per the relocation timeline."
                                                }
                                            ]
                                        }
                                    ],
                                    "totalQuestions": 15,
                                    "lastUpdated": "2025-08-25T14:30:00Z"
                                }
                            },
                            "404_not_found": {
                                "error": True,
                                "message": "FAQ not found", 
                                "result": None
                            }
                        }
                    }
                ]
            }
        },
        
        # ================================
        # GENERAL API INFORMATION
        # ================================
        "general_info": {
            "authentication": {
                "type": "JWT Bearer Token",
                "description": "Most endpoints require JWT authentication. Include token in Authorization header.",
                "header_format": "Authorization: Bearer <your_jwt_token>",
                "token_expiry": f"{JWT_EXPIRE_MIN} minutes",
                "refresh_endpoint": "/auth/refresh"
            },
            "response_format": {
                "success_response": {
                    "error": "boolean - false for success",
                    "message": "string - Success message",
                    "result": "object/array - Response data"
                },
                "error_response": {
                    "error": "boolean - true for errors", 
                    "message": "string - Error description",
                    "result": "null - No data on error"
                }
            },
            "http_status_codes": {
                "200": "OK - Request successful",
                "400": "Bad Request - Invalid request parameters",
                "401": "Unauthorized - Invalid or missing authentication",
                "404": "Not Found - Resource not found",
                "422": "Unprocessable Entity - Validation error",
                "500": "Internal Server Error - Server-side error"
            },
            "data_types": {
                "villageId": "string - Format: V001, V002, etc.",
                "familyId": "string - Format: F001, F002, etc.",
                "dates": "ISO 8601 format - YYYY-MM-DDTHH:MM:SSZ",
                "coordinates": "decimal degrees - latitude/longitude",
                "relocationOption": "integer - 1 or 2",
                "stage": "integer - Current relocation stage (1-5)",
                "subStage": "integer - Current sub-stage within main stage"
            },
            "pagination": {
                "note": "Currently not implemented - all endpoints return complete data",
                "future_parameters": "limit, offset will be added in future versions"
            },
            "rate_limiting": {
                "description": "Currently no rate limiting implemented",
                "future_plans": "Will implement rate limiting based on user roles"
            }
        },
        


    }
    
    return jsonify(api_docs)

if __name__ == "__main__":
    app.run(debug=True)

