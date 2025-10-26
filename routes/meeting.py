import datetime as dt
import logging

from flask import Flask, Blueprint, logging,request, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from utils.tokenAuth import auth_required
from models.counters import get_next_meeting_id
from models.meeting import Meeting, MeetingInsert, MeetingUpdate
from utils.helpers import authorization, make_response
from models.family import Family, FamilyCard, FamilyUpdate
from config import JWT_EXPIRE_MIN, db

from pymongo import errors  


meetings=db.meetings

meeting_bp = Blueprint("meetings",__name__)

@meeting_bp.route("/meetings/insert", methods=["POST"])
def insert_meeting(decoded_data):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId") 

        if not payload or not userId:
            return make_response(True, "Request body missing", status=400)
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])

        # Validate input
        try:
            meeting_obj = MeetingInsert(**payload)
        except ValidationError as ve:
            return make_response(True, "Validation error", result=ve.errors(), status=400)
        except ValueError as ve:
            return make_response(True, "Validation error", result=[{"error": str(ve)}], status=400)

        # Generate new meetingId
        new_id = get_next_meeting_id(db, meeting_obj.villageId)

        # Create full meeting record
        meeting_record = Meeting(
            meetingId=new_id,
            **meeting_obj.model_dump(exclude_none=True)
        )

        # Insert into DB
        db.meetings.insert_one(meeting_record.model_dump(exclude_none=True))

        return make_response(
            False,
            "Meeting inserted successfully",
            result=meeting_record.model_dump(exclude_none=True),
            status=201
        )

    except errors.PyMongoError as e:
        return make_response(True, f"Database error: {str(e)}", status=500)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)


@meeting_bp.route("/meetings/<meeting_id>", methods=["DELETE"])
@auth_required
def delete_meeting(decoded_data,meeting_id):
    try:
        # ✅ Get JSON payload safely
        payload = request.get_json(force=True)  # won't raise if no JSON
        userId = payload.pop("userId") 

        if not payload or not userId:
            return make_response(True, "Request body missing", status=400)
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        held_by = payload.get("heldBy") if payload else None

        # ✅ Validate heldBy
        if not held_by or not isinstance(held_by, str) or not held_by.strip():
            return make_response(True, "Missing or invalid 'heldBy' in request body", status=400)

        # ✅ Attempt deletion
        result = db.meetings.delete_one({"meetingId": meeting_id, "heldBy": held_by.strip()})

        if result.deleted_count == 0:
            # Could be meeting does not exist or heldBy does not match
            exists = db.meetings.find_one({"meetingId": meeting_id})
            if not exists:
                msg = f"Meeting {meeting_id} not found"
            else:
                msg = f"Meeting {meeting_id} exists but not held by {held_by}"
            return make_response(True, msg, status=404)

        # ✅ Successful deletion
        return make_response(False, f"Meeting {meeting_id} deleted successfully", status=200)

    except errors.PyMongoError as e:
        # ✅ Database-level error
        return make_response(True, f"Database error: {str(e)}", status=500)
    except Exception as e:
        # ✅ Catch-all for unexpected errors
        return make_response(True, f"Unexpected error: {str(e)}", status=500)

@meeting_bp.route("/meetings/<meeting_id>", methods=["PUT"])
@auth_required
def update_meeting(decoded_data,meeting_id):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId") 

        if not payload or not userId:
            return make_response(True, "Request body missing", status=400)
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        held_by = payload.get("heldBy")
        if not held_by or not held_by.strip():
            return make_response(True, "Missing or invalid 'heldBy'", status=400)

        # Validate fields using MeetingUpdate model
        try:
            update_obj = MeetingUpdate(**payload)
        except ValidationError as ve:
            return make_response(True, "Validation error", result=ve.errors(), status=400)
        except ValueError as ve:
            return make_response(True, "Validation error", result=[{"error": str(ve)}], status=400)

        update_dict = {k: v for k, v in update_obj.model_dump().items() if v is not None}

        # Update only if the meeting exists AND heldBy matches
        result = db.meetings.update_one(
            {"meetingId": meeting_id, "heldBy": held_by},
            {"$set": update_dict}
        )

        if result.matched_count == 0:
            return make_response(
                True,
                f"Meeting {meeting_id} not found or not held by '{held_by}'",
                status=404
            )

        return make_response(
            False,
            f"Meeting {meeting_id} updated successfully",
            result=update_dict,
            status=200
        )

    except errors.PyMongoError as e:
        return make_response(True, f"Database error: {str(e)}", status=500)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)


@meeting_bp.route("/meetings/<villageId>", methods=["GET"])
@auth_required
def get_meetings(decoded_data, villageId):
    try:
        args = request.args
        # Extract filters
        from_date = args.get("fromDate")
        to_date = args.get("toDate")
        venue = args.get("venue")
        heldBy = args.get("heldBy")

        page = int(args.get("page", 1))
        limit = int(args.get("limit", 15))

        # Build query
        query = {"villageId": villageId}
        if heldBy:
            query["heldBy"] = heldBy
        if venue:
            query["venue"] = {"$regex": venue, "$options": "i"}  # ✅ allows partial match (e.g. "school")

        # Date filtering
        if from_date or to_date:
            date_filter = {}
            if from_date:
                date_filter["$gte"] = from_date
            if to_date:
                date_filter["$lte"] = to_date
            query["time"] = date_filter

        projection = {"_id": 0, "photos": 0, "docs": 0}
        skip = (page - 1) * limit

        cursor = (
            meetings.find(query, projection)
            .sort("time", -1)
            .skip(skip)
            .limit(limit)
        )

        update_items = list(cursor)
        total_count = meetings.count_documents(query)

        if not update_items:
            return make_response(
                True,
                f"No meetings found",
                result={"count": 0, "items": []},
                status=404,
            )

        return make_response(
            False,
            "meetings fetched successfully",
            result={
                "count": total_count,
                "page": page,
                "limit": limit,
                "items": update_items,
            },
        )

    except Exception as e:
        return make_response(
            True,
            f"Error fetching meetings: {str(e)}",
            result={"count": 0, "items": []},
            status=500,
        )
