import datetime as dt
from flask import Flask, Blueprint,request, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING, ReturnDocument,errors as mongo_errors
from utils.helpers import hash_password, make_response, validation_error_response
from models.counters import get_next_user_id
from models.emp import  UserInsert, UserUpdate, Users
from config import JWT_EXPIRE_MIN, db
from pymongo.errors import DuplicateKeyError



users = db.users
villages = db.villages

emp_bp = Blueprint("emp",__name__)

def validate_village_ids(village_ids: list):
    if not village_ids:
        return True, []
    
    # Fetch all valid village IDs from villages collection
    valid_villages = set(v["villageId"] for v in villages.find({}, {"villageId": 1, "_id": 0}))
    
    # Find invalid IDs
    invalid_ids = [vid for vid in village_ids if vid not in valid_villages]
    
    return len(invalid_ids) == 0, invalid_ids

@emp_bp.route("/employee/add", methods=["POST"])
def add_employee():
    try:
        payload = request.get_json(force=True)
        if not payload or "password" in payload:
            return make_response(True, "Missing request body/ password not required", status=400)
        try:
            emp = UserInsert(**payload)
            is_valid, invalid_ids = validate_village_ids(emp.villageID)
            if not is_valid:
                return make_response(True, f"Invalid villageIDs: {invalid_ids}", status=400)

        except ValidationError as ve:
            return validation_error_response(ve)




        emp_dict = emp.model_dump(exclude={"password","activated"})
        userId = get_next_user_id(db)

        comp_emp=Users(
            userId=userId,
            activated=True,
            verified=False,
            password="",
            #userCounters = {v: UserCounters().model_dump() for v in emp.villageID},
             **emp_dict
                    
        )
        #emp_dict.update({"userId": userId, "password": hashed_pw})

        users.insert_one(comp_emp.model_dump(exclude_none=True))

        return make_response(False, "Employee added successfully", result={"userId": userId}, status=201)

    except ValidationError as ve:
        return validation_error_response(ve)
    except DuplicateKeyError as dk:
        # Extract which field caused duplicate from dk.details or the error string
        # dk.details may not always be available, so fallback to parsing string
        errmsg = str(dk)
        if "email" in errmsg:
            return make_response(True, f"Employee with email {emp.email} already exists", status=400)
        elif "mobile" in errmsg:
            return make_response(True, f"Employee with mobile {emp.mobile} already exists", status=400)
        else:
            return make_response(True, "Employee already exists", status=400)
    
    except mongo_errors.PyMongoError as me:
        return make_response(True, "Database error", result=str(me), status=500)

    
    except Exception as e:
        return make_response(True, "Unexpected error", result=str(e), status=500)

@emp_bp.route("/employee/bulk_add", methods=["POST"])
def bulk_add_employees():
    try:
        payload = request.get_json(force=True)
        if not payload or "employees" not in payload:
            return make_response(True, "Missing 'employees' in request body or password is not required", status=400)
        
        employees = payload["employees"]
        if not isinstance(employees, list):
            return make_response(True, "'employees' must be a list", status=400)
        
        inserted, skipped, errors_list = [], [], []

        for emp_payload in employees:
            try:
                forbidden_fields = {"password"}
                if any(f in emp_payload for f in forbidden_fields):
                    errors_list.append({
                        "employee_name": emp_payload.get("name"),
                        "error": f"Fields {forbidden_fields} not allowed at insert"
                    })
                    continue

                emp = UserInsert(**emp_payload)  # validate first
                is_valid, invalid_ids = validate_village_ids(emp.villageID)
                if not is_valid:
                    errors_list.append({
                        "employee_name": emp.name,
                        "error": f"Invalid villageIDs: {invalid_ids}"
                    })
                    continue
                # Check duplicates
                if users.find_one({"email": emp.email, "deleted": False}):
                    skipped.append({"email": emp.email, "reason": "Email already exists"})
                    continue
                if users.find_one({"mobile": emp.mobile, "deleted": False}):
                    skipped.append({"mobile": emp.mobile, "reason": "Mobile already exists"})
                    continue

                emp_dict = emp.model_dump(exclude={"password","activated"})
                userId = get_next_user_id(db)

                comp_emp = Users(
                    userId=userId,
                    activated=True,
                    verified=False,

                    password="",
                    #userCounters = {v: UserCounters().model_dump() for v in emp.villageID},
                    **emp_dict
                )

                users.insert_one(comp_emp.model_dump(exclude_none=True))
                inserted.append(comp_emp.name)

            except ValidationError as ve:
                error_messages = [str(error) for error in ve.errors()]
                errors_list.append({
                    "employee_name": emp_payload.get("name"),
                    "error": error_messages
                })

            except DuplicateKeyError as dk:
                skipped.append({"email": emp_payload.get("email"), "reason": "Duplicate key error"})

            except Exception as e:
                errors_list.append({
                    "employee_name": emp_payload.get("name"),
                    "error": str(e)
                })

        # Build summary AFTER loop
        summary = {
            "inserted": inserted,
            "skipped_existing": skipped,
            "validation_errors": errors_list
        }

        return make_response(False, "Bulk insert completed", result=summary, status=200)

    except mongo_errors.PyMongoError as e:
        return make_response(True, f"Database error: {str(e)}", status=500)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)

@emp_bp.route("/employee/update/<emp_id>", methods=["PUT"])
def update_employee(emp_id):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)
        forbidden_fields = {"password"}
        if any(f in payload for f in forbidden_fields):
            return make_response(True, f"Fields {forbidden_fields} are not allowed here", status=400)
        try:
            update_data = UserUpdate(**payload).model_dump(exclude_none=True)
        except ValidationError as ve:
            return validation_error_response(ve)
        emp = users.find_one({"userId": emp_id,"deleted":False},{"_id": 0,"userCounters":1})
        if not emp:
            return make_response(True, "Employee not found", status=404)
        if "villageID" in update_data:
            is_valid, invalid_ids = validate_village_ids(update_data["villageID"])
            if not is_valid:
                return make_response(True, f"Invalid villageIDs: {invalid_ids}", status=400)

        if not update_data:
            return make_response(True, "No valid fields to update", status=400)


        result = users.update_one(
            {"userId": emp_id},
            {"$set": update_data},
            return_document=ReturnDocument.AFTER
        )

        if not result:
            return make_response(True, "Employee not found", status=404)

        return make_response(False, "Employee updated successfully",result=update_data,status=200)

    except ValidationError as ve:
        return validation_error_response(ve)

    except mongo_errors.PyMongoError as me:
        return make_response(True, "Database error", result=str(me), status=500)

    except Exception as e:
        return make_response(True, "Unexpected error", result=str(e), status=500)

@emp_bp.route("/employee/activate/<emp_id>", methods=["PUT"])
def activate_employee(emp_id):
    try:
        result = users.find_one_and_update(
            {"userId": emp_id, "deleted": False},
            {"$set": {"activated": True}},
            projection={"userId": 1, "activated": 1, "_id": 0},
            return_document=ReturnDocument.AFTER
        )

        if not result:
            return make_response(True, "Employee not found or deleted", status=404)

        return make_response(False, "Employee activated successfully", result=result, status=200)

    except mongo_errors as me:
        return make_response(True, "Database error", result=str(me), status=500)
    except Exception as e:
        return make_response(True, "Unexpected error", result=str(e), status=500)

@emp_bp.route("/employee/deactivate/<emp_id>", methods=["PUT"])
def deactivate_employee(emp_id):
    try:
        result = users.find_one_and_update(
            {"userId": emp_id, "deleted": False},
            {"$set": {"activated": False}},
            projection={"userId": 1, "activated": 1, "_id": 0},
            return_document=ReturnDocument.AFTER
        )

        if not result:
            return make_response(True, "Employee not found or deleted", status=404)

        return make_response(False, "Employee deactivated successfully", result=result, status=200)

    except mongo_errors as me:
        return make_response(True, "Database error", result=str(me), status=500)
    except Exception as e:
        return make_response(True, "Unexpected error", result=str(e), status=500)

@emp_bp.route("/employee/delete/<emp_id>", methods=["DELETE"])
def delete_employee(emp_id):
    try:
        result = users.delete_one({"userId": emp_id})
        if result.deleted_count == 0:
            return make_response(True, "Employee not found", status=404)

        return make_response(False, "Employee deleted successfully")

    except mongo_errors.PyMongoError as me:
        return make_response(True, "Database error", result=str(me), status=500)

    except Exception as e:
        return make_response(True, "Unexpected error", result=str(e), status=500)

@emp_bp.route("/employee/delete_all", methods=["DELETE"])
def delete_all_employees():
    try:
        result=users.delete_many({})
        return make_response(
            False,
            f"Deleted {result.deleted_count} employees",
            status=200
        )
    except mongo_errors.PyMongoError as me:
        return make_response(True, "Database error", result=str(me), status=500)

    except Exception as e:
        return make_response(True, "Unexpected error", result=str(e), status=500)

@emp_bp.route("/employee/all", methods=["GET"])
def get_all_employees():
    try:
        employees = list(users.find(
            {},
            {"_id": 0,
            "userId": 1, 
            "name": 1, 
            "email": 1, 
            "role": 1, 
            "mobile": 1,
            "villageID":1,
            "activated":1,
            "verified":1}
        ))
        return make_response(False, "Employees fetched successfully", result={"count": len(employees), "items": employees},status=200)

    except mongo_errors.PyMongoError as me:
        return make_response(True, "Database error", message=str(me),  result={"count": 0, "items": []},status=500)

    except Exception as e:
        return make_response(True, "Unexpected error", message=str(e), result={"count": 0, "items": []},status=500)

@emp_bp.route("/employee/ids", methods=["GET"])
def get_emp_ids():
    try:
        employees = list(users.find(
            {},
            {"_id": 0,
            "userId": 1, 
            "name": 1,
            }
        ))
        return make_response(False, "Employees fetched successfully", result={"count": len(employees), "items": employees},status=200)

    except mongo_errors.PyMongoError as me:
        return make_response(True, "Database error", message=str(me),  result={"count": 0, "items": []},status=500)

    except Exception as e:
        return make_response(True, "Unexpected error", message=str(e), result={"count": 0, "items": []},status=500)


# @emp_bp.route("/employee/<emp_id>", methods=["GET"])
# def get_employee_details(emp_id):
#     try:
#         if not emp_id or not isinstance(emp_id, str):
#             return make_response(True, "Invalid or missing emp_id", status=400)

#         emp = users.find_one({"userId": emp_id,"deleted":False},{"_id": 0,"otp":0,"password":0})
#         if not emp:
#             return make_response(True, "Employee not found", status=404)

#         return make_response(False, "Employee fetched successfully", result=emp)

#     except mongo_errors.PyMongoError as me:
#         return make_response(True, "Database error", result=str(me), status=500)

#     except Exception as e:
#         return make_response(True, "Unexpected error", result=str(e), status=500)