

from flask import Blueprint, request
from pydantic import ValidationError
from models.village import Logs
from models.complaints import StatusHistory
from models.facilities import FacilityVerification, FacilityVerificationInsert, FacilityVerificationUpdate
from utils.tokenAuth import auth_required
from models.stages import statusHistory
from config import db
from utils.helpers import STATUS_TRANSITIONS, authorization, make_response, nowIST, validation_error_response
from models.counters import get_next_facilityVerification_id, get_next_material_id, get_next_materialUpdate_id
from datetime import datetime

facility_verifications_bp = Blueprint("facility_verification", __name__)
facility_updates = db.facilityUpdates
facilities = db.facilities  # reference to main materials collection

logs=db.logs

@facility_verifications_bp.route("/facility_verification/insert", methods=["POST"])
@auth_required
def insert_facility_verification(decoded_data):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        facilityId=payload.pop("facilityId")
        villageId=payload.pop("villageId")
        if not payload or not userId:
            return make_response(True, "Missing request body or userId", status=400)

        # Authorization check
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])

        # Validate input
        try:
            verification_obj = FacilityVerificationInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # Check if facility exists
        facility = facilities.find_one({"facilityId": facilityId,"villageId":villageId},{"_id":0})
        if not facility:
            return make_response(True, "Facility not found", status=404)

        # Generate unique verificationId
        verification_id = get_next_facilityVerification_id(facilityId=facilityId, db=db)
        now = nowIST()

        history = statusHistory(
            status=1,
            comments="created",
            verifier=userId,
            time=str(now)
        )

        verification_doc = FacilityVerification(
            verificationId=verification_id,
            facilityId=facilityId,
            villageId=villageId,
            name=verification_obj.name,
            docs=verification_obj.docs,
            notes=verification_obj.notes,
            status=1,
            verifiedAt=str(now),
            verifiedBy=userId,
            insertedBy=userId,
            insertedAt=str(now),

            statusHistory=[history.model_dump()]
        )

        facility_updates.insert_one(verification_doc.model_dump(exclude_none=True))
        log=Logs(
            userId=userId,
            updateTime=nowIST(),
            type='Facilities',
            action='Verification Insert',
            comments="",
            relatedId=verification_id,
            villageId=villageId
        )

        # Insert into DB
        logs.insert_one(log.model_dump())
        return make_response(False, "Facility verification inserted successfully", result=verification_doc.model_dump(exclude_none=True))

    except Exception as e:
        return make_response(True, f"Error inserting facility verification: {str(e)}", status=500)


@facility_verifications_bp.route("/facility_verification/<verificationId>", methods=["PUT"])
@auth_required
def update_facility_verification(decoded_data, verificationId):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing request body or userId", status=400)

        # Authorization
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])

        # Validate input
        try:
            update_obj = FacilityVerificationUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        existing = facility_updates.find_one({"verificationId": verificationId})

        if not existing:
            return make_response(True, "Facility verification not found", status=404)
        villageId=existing.get("villageId")
        update_dict = update_obj.model_dump(exclude_none=True)
        if not update_dict:
            return make_response(True, "No valid fields to update", status=400)

        now = nowIST()
        history = statusHistory(
            status=1,
            comments=update_obj.notes or "updated",
            verifier=userId,
            time=str(now)
        )

        facility_updates.update_one(
            {"verificationId": verificationId},
            {"$set": update_dict, "$push": {"statusHistory": history.model_dump(exclude_none=True)}}
        )
        log=Logs(
            userId=userId,
            updateTime=nowIST(),
            type='Facilities',
            action='Verification Edited',
            comments="",
            relatedId=verificationId,
            villageId=villageId
        )

        # Insert into DB
        logs.insert_one(log.model_dump())
        return make_response(False, "Facility verification updated successfully", result=update_dict)

    except Exception as e:
        return make_response(True, f"Error updating facility verification: {str(e)}", status=500)


@facility_verifications_bp.route("/facility_verification/<verificationId>", methods=["DELETE"])
@auth_required
def delete_facility_verification(decoded_data, verificationId):
    try:
        payload = request.get_json(force=True)
        userId = payload.get("userId")

        if not payload or not userId:
            return make_response(True, "Missing request body or userId", status=400)

        # Authorization
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])

        existing = facility_updates.find_one({"verificationId": verificationId})
        if not existing:
            return make_response(True, "Facility verification not found", status=404)
        villageId=existing.get("villageId")

        # Hard delete
        facility_updates.delete_one({"verificationId": verificationId})
        log=Logs(
            userId=userId,
            updateTime=nowIST(),
            type='Facilities',
            action='Verification Deleted',
            comments="",
            relatedId=verificationId,
            villageId=villageId
        )

        # Insert into DB
        logs.insert_one(log.model_dump())
        return make_response(False, "Facility verification deleted successfully")

    except Exception as e:
        return make_response(True, f"Error deleting facility verification: {str(e)}", status=500)


@facility_verifications_bp.route("/facility_verification/one/<verificationId>", methods=["GET"])
@auth_required
def get_facility_verification(decoded_data,verificationId):
    try:
        doc = facility_updates.find_one({"verificationId":verificationId}, {"_id": 0})
        if not doc:
            return make_response(True, "No facility verification found", status=404)
        return make_response(False, "Facility verification fetched successfully", result=doc)
    except Exception as e:
        return make_response(True, f"Error fetching facility verification: {str(e)}", status=500)


@facility_verifications_bp.route("/facility_verification/<villageId>/<facilityId>", methods=["GET"])
@auth_required
def get_facility_verifications_all(decoded_data,villageId,facilityId):
    try:
        # --- Extract query parameters ---
        args = request.args
        status = args.get("status")
        name=args.get("name")
        user_role = decoded_data.get("role")  # Optional user role/status
        from_date = args.get("fromDate")
        to_date = args.get("toDate")
        page = int(args.get("page", 1))
        limit = int(args.get("limit", 15))
        # --- Build MongoDB filter query dynamically ---
        query = {"facilityId": facilityId,"villageId":villageId}

        if status:
            query["status"] = int(status)
        elif user_role in STATUS_TRANSITIONS:
            query["status"] = STATUS_TRANSITIONS[user_role]
        if name:
            query["name"] = {"$regex": name, "$options": "i"}
        # --- Date Range Filtering ---
        if from_date or to_date:
            date_filter = {}
            if from_date:
                date_filter["$gte"] = (from_date)
            if to_date:
                date_filter["$lte"] = (to_date)
            query["insertedAt"] = date_filter

        # --- Projection (exclude heavy fields) ---
        projection = {"_id": 0, "statusHistory": 0, "docs": 0}

        # --- Sorting & Pagination ---
        skip = (page - 1) * limit

        cursor = (
            facility_updates.find(query, projection)
            .sort("insertedAt", -1)  # latest first
            .skip(skip)
            .limit(limit)
        )

        verifications = list(cursor)
        total_count = facility_updates.count_documents(query)

        if not verifications:
            return make_response(
                True,
                "No verifications found",
                result={"count": 0, "items": []},
                status=404,
            )

        return make_response(
            False,
            "Verifications fetched successfully",
            result={
                "count": total_count,
                "page": page,
                "limit": limit,
                "items": verifications,
            },
        )

    except ValueError as ve:
        return make_response(
            True,
            f"Invalid date format: {str(ve)}",
            result={"count": 0, "items": []},
            status=400,
        )

    except Exception as e:
        return make_response(
            True,
            f"Error fetching verifications: {str(e)}",
            result={"count": 0, "items": []},
            status=500,
        )


@facility_verifications_bp.route("/facility_verification/verify", methods=["POST"])
@auth_required
def verify_verification(decoded_data):
    try:
        payload = request.get_json(force=True)
        facilityId = payload.get("facilityId")
        verificationId = payload.get("verificationId")
        userId = payload.get("userId")
        status = payload.get("status")  # 1=accept, -1=send back
        comments = payload.get("comments", "")


        if not facilityId or not verificationId or not userId or not comments or status not in [1, -1]:
            return make_response(True, "Missing required fields", status=400)
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        user_role = decoded_data.get("role")

        update = facility_updates.find_one({"facilityId":facilityId,"verificationId":verificationId}, {"_id": 0})

        if not update:
            return make_response(True, "Update not found", status=404)
        previous_status = update.get("status", 1) 
        villageId=update.get("villageId")

        
        required_status = STATUS_TRANSITIONS.get(user_role)
        if not required_status or previous_status != required_status:
            return make_response(True, f"Unauthorized: {user_role} cannot verify status {previous_status}", status=403)


        # Update status
        now = nowIST()
        final_status = min(max(previous_status + status, 1), 4)
        new_history=StatusHistory(
            status=1,
            comments=comments,
            verifier=userId,
            time=str(now)
        )


        facility_updates.update_one(
            {"verificationId": verificationId, "facilityId": facilityId},
            {
                "$set": {
                    "status": final_status,
                    "verifiedBy": userId,
                    "verifiedAt": now,
                },
                "$push": {"statusHistory": new_history.model_dump(exclude_none=True)}
            },
            upsert=False
        )
        log=Logs(
            userId=userId,
            updateTime=nowIST(),
            type='Facilities',
            action='Action',
            comments=comments,
            relatedId=verificationId,
            villageId=villageId
        )

        # Insert into DB
        logs.insert_one(log.model_dump())
        return make_response(False, "Verification status updated successfully", result=new_history.model_dump())

    except Exception as e:
        return make_response(True, f"Error verifying update: {str(e)}", status=500)
