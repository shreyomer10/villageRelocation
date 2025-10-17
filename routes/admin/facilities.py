from flask import Blueprint, request
from pydantic import ValidationError
from models.facilities import Facility, FacilityInsert, FacilityUpdate
from utils.helpers import make_response, validation_error_response
from config import db
from models.constructionMaterial import MaterialInsert, MaterialUpdate, Material  # your Pydantic models
from models.counters import get_next_facility_id, get_next_material_id

facilities_bp = Blueprint("facilities", __name__)
facilities = db.facilities


# ================= CREATE FACILITY =================
@facilities_bp.route("/facilities", methods=["POST"])
def insert_facility():
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

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
def update_facility(facilityId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

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

        facilities.update_one({"facilityId": str(facilityId)}, {"$set": update_dict})

        return make_response(False, "Facility updated successfully", result=update_dict)
    except Exception as e:
        return make_response(True, f"Error updating facility: {str(e)}", status=500)


# ================= SOFT DELETE FACILITY =================
@facilities_bp.route("/facilities/<facilityId>", methods=["DELETE"])
def delete_facility(facilityId):
    try:
        facility = facilities.find_one({"facilityId": str(facilityId), "deleted": False})
        if not facility:
            return make_response(True, "Facility not found", status=404)

        # Soft delete: mark deleted=True
        facilities.update_one({"facilityId": str(facilityId)}, {"$set": {"deleted": True}})

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
