import datetime as dt
import logging

from flask import Flask, Blueprint, logging,request, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from models.counters import get_next_meeting_id
from models.meeting import Meeting, MeetingInsert, MeetingUpdate
from utils.helpers import make_response
from models.family import Family, FamilyCard, FamilyUpdate
from config import JWT_EXPIRE_MIN, db

from pymongo import errors  


meetings=db.meetings

meeting_bp = Blueprint("meetings",__name__)

@meeting_bp.route("/meetings/insert", methods=["POST"])
def insert_meeting():
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

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

@meeting_bp.route("/meetings/<village_id>", methods=["GET"])
def get_meetings_by_village(village_id):
    try:
        # Fetch meetings for the village, exclude MongoDB _id
        meetings = list(db.meetings.find({"villageId": village_id}, {"_id": 0}))

        if not meetings:
            return make_response(
                True,
                f"No meetings found for village '{village_id}'",
                result=[],
                status=404
            )

        return make_response(
            False,
            f"Meetings for village '{village_id}' retrieved successfully",
            result=meetings,
            status=200
        )

    except errors.PyMongoError as e:
        # Database-level errors
        return make_response(
            True,
            f"Database error while fetching meetings: {str(e)}",
            result=None,
            status=500
        )
    except Exception as e:
        # Catch-all for unexpected errors
        return make_response(
            True,
            f"Unexpected error: {str(e)}",
            result=None,
            status=500
        )


@meeting_bp.route("/meetings/heldby/<held_by>", methods=["GET"])
def get_meetings_held_by(held_by):
    try:
        if not held_by.strip():
            return make_response(
                True,
                "Invalid 'heldBy' parameter",
                result=[],
                status=400
            )

        # Fetch meetings held by this user, exclude MongoDB _id
        meetings = list(db.meetings.find({"heldBy": held_by}, {"_id": 0}))

        if not meetings:
            return make_response(
                True,
                f"No meetings found held by '{held_by}'",
                result=[],
                status=404
            )

        return make_response(
            False,
            f"Meetings held by '{held_by}' retrieved successfully",
            result=meetings,
            status=200
        )

    except errors.PyMongoError as e:
        # Database-level errors
        return make_response(
            True,
            f"Database error while fetching meetings: {str(e)}",
            result=None,
            status=500
        )
    except Exception as e:
        # Catch-all for unexpected errors
        return make_response(
            True,
            f"Unexpected error: {str(e)}",
            result=None,
            status=500
        )


@meeting_bp.route("/meetings/<meeting_id>", methods=["DELETE"])
def delete_meeting(meeting_id):
    try:
        # ✅ Get JSON payload safely
        payload = request.get_json(silent=True)  # won't raise if no JSON
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
def update_meeting(meeting_id):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

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
