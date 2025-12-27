from flask import Blueprint, request
from pydantic import ValidationError
from models.village import Logs
from utils.tokenAuth import auth_required
from models.facilities import Facility, FacilityInsert, FacilityUpdate
from utils.helpers import authorizationDD, make_response, nowIST, validation_error_response
from config import db
from models.constructionMaterial import MaterialInsert, MaterialUpdate, Material  # your Pydantic models
from models.counters import get_next_facility_id, get_next_material_id

facilities_bp = Blueprint("facilities", __name__)
facilities = db.facilities

logs=db.logs

# ================= CREATE FACILITY =================
@facilities_bp.route("/facilities", methods=["POST"])
@auth_required
def insert_facility(decoded_data):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)
        error = authorizationDD(decoded_data)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        # Validate
        try:
            facility_obj = FacilityInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # Generate facilityId
        new_facility_id = get_next_facility_id(villageId=facility_obj.villageId,db=db)

        facility_complete = Facility(
            facilityId=new_facility_id,
            **facility_obj.model_dump(exclude_none=True),
            deleted=False
        )

        facilities.insert_one(facility_complete.model_dump(exclude_none=True))
        log=Logs(
            userId=decoded_data.get("userId"),
            updateTime=nowIST(),
            type='Facilities',
            action='Insert',
            comments="",
            relatedId=new_facility_id,
            villageId=facility_obj.villageId
        )

        # Insert into DB
        logs.insert_one(log.model_dump())
        return make_response(
            False,
            "Facility inserted successfully",
            result=facility_complete.model_dump(exclude_none=True),
            status=200
        )
    except Exception as e:
        return make_response(True, f"Error inserting facility: {str(e)}", status=500)


# ================= UPDATE FACILITY =================
@facilities_bp.route("/facilities/<facilityId>", methods=["PUT"])
@auth_required
def update_facility(decoded_data,facilityId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)
        error = authorizationDD(decoded_data)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        try:
            update_obj = FacilityUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        update_dict = update_obj.model_dump(exclude_none=True)
        if not update_dict:
            return make_response(True, "No valid fields to update", status=400)

        facility = facilities.find_one({"facilityId": str(facilityId), "deleted": False})
        if not facility:
            return make_response(True, "Facility not found", status=404)
        villageId=facility.get("villageId")
        facilities.update_one({"facilityId": str(facilityId)}, {"$set": update_dict})
        log=Logs(
            userId=decoded_data.get("userId"),
            updateTime=nowIST(),
            type='Facilities',
            action='Edited',
            comments="",
            relatedId=facilityId,
            villageId=villageId
        )

        # Insert into DB
        logs.insert_one(log.model_dump())
        return make_response(False, "Facility updated successfully", result=update_dict)
    except Exception as e:
        return make_response(True, f"Error updating facility: {str(e)}", status=500)


# ================= SOFT DELETE FACILITY =================
@facilities_bp.route("/facilities/<facilityId>", methods=["DELETE"])
@auth_required
def delete_facility(decoded_data,facilityId):
    try:
        error = authorizationDD(decoded_data)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        facility = facilities.find_one({"facilityId": str(facilityId), "deleted": False})
        if not facility:
            return make_response(True, "Facility not found", status=404)
        villageId=facility.get("villageId")

        # Soft delete: mark deleted=True
        facilities.update_one({"facilityId": str(facilityId)}, {"$set": {"deleted": True}})
        log=Logs(
            userId=decoded_data.get("userId"),
            updateTime=nowIST(),
            type='Facilities',
            action='Delete',
            comments="",
            relatedId=facilityId,
            villageId=villageId
        )

        # Insert into DB
        logs.insert_one(log.model_dump())
        return make_response(False, "Facility deleted successfully (soft delete)")
    except Exception as e:
        return make_response(True, f"Error deleting facility: {str(e)}", status=500)


@facilities_bp.route("/facilities", methods=["GET"])
def get_facilities():
    try:
        docs = list(facilities.find({"deleted": False}, {"_id": 0}))

        if not docs:
            return make_response(True, "No facilities found", result={"count": 0, "items": []}, status=404)

        return make_response(False, "Facilities fetched successfully", result={"count": len(docs), "items": docs}, status=200)
    except Exception as e:
        return make_response(True, f"Error fetching facilities: {str(e)}", status=500)
