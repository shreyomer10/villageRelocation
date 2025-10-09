
import datetime as dt
from flask import Flask, Blueprint, logging,request, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from models.counters import get_next_village_id
from utils.helpers import make_response, nowIST, validation_error_response
from models.village import FamilyCount, SubStage, Village, VillageCard, VillageDocComplete, VillageDocInsert, VillageDocUpdate, VillageLog
from config import JWT_EXPIRE_MIN, db

import logging

users = db.users
villages = db.villages
stages = db.stages
families = db.families

village_bp = Blueprint("village",__name__)






@village_bp.route("/villages", methods=["GET"])
def get_all_villages():
    try:
        projection = {
            "_id": 0,
            "villageId": 1,
            "name": 1,
            "currentStage": 1,
            "currentSubStage": 1,
            "completed_substages":1,
            "updatedAt": 1,
            "updatedBy": 1,
            "siteOfRelocation": 1,
            "areaDiverted": 1,
            "lat":1,
            "long":1
        }

        cursor = villages.find({}, projection).sort("name", ASCENDING)
        result = []

        for doc in cursor:
            try:
                village = VillageCard.from_mongo(doc)  # validate via Pydantic
                result.append(village.model_dump())
            except Exception as ve:
                logging.error(f"VillageCard validation failed: {ve}")
                continue
        return jsonify({
            "error": False,
            "message": "Successfully Fetched Villages",
            "result": result
        }), 200

    except Exception as e:
        logging.exception("Error fetching villages")
        return jsonify({
            "error":True, 
            "message": str(e),
            "result":[]
        }), 500

@village_bp.route("/villagesId", methods=["GET"])
def get_all_villages_ids():
    try:
        projection = {
            "_id": 0,
            "villageId": 1,
            "name": 1,
        }

        cursor = villages.find({}, projection).sort("name", ASCENDING)
        
        # Convert cursor to list of dicts
        result = list(cursor)
        return make_response(error=False,message="Successfully fetched VillageId's.",result=result,status=200)


    except Exception as e:
        #logging.exception("Error fetching villages")
        return make_response(error=True,message= str(e),result=[],status=500)

@village_bp.route("/villages/<village_id>", methods=["GET"])
def get_village_data(village_id):
    try:
        v = villages.find_one({"villageId": village_id}, {"_id": 0,"updates":0})
        if not v:
            return jsonify({
                "error": True,
                "message": "Not Found",
                "result": []
            }), 404

        # Directly return the Mongo dict (already JSON-serializable)
        return jsonify({
            "error": False,
            "message": "Successfully fetched village",
            "result": v
        }), 200

    except Exception as e:
        logging.exception("Error fetching village")
        return jsonify({
            "error": True,
            "message": f"Failed to fetch village: {e}",
            "result": []
        }), 500

@village_bp.route("/villages/insert", methods=["POST"])
def add_village():
    try:
        payload = request.get_json(force=True)
        userId = payload.get("emp_id")

        if not payload or not userId:
            return make_response(True, "Missing request body", status=400)
        payload.pop("emp_id")

        try:
            validated = VillageDocInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # Convert Insert -> Complete
        village_id = get_next_village_id(db)
        now = nowIST()

        log = [VillageLog(name="Village Insert", updateTime=now, updateBy=userId)]
        complete_doc = VillageDocComplete(
            **validated.model_dump(),
            villageId=village_id,
            currentStage="",
            currentSubStage="",
            logs=log,
            updates=[],
            completed_substages=[],
            delete=False
        )

        villages.insert_one(complete_doc.model_dump(exclude_none=True))

        return make_response(
            False,
            "Village inserted successfully",
            result=complete_doc.model_dump(exclude_none=True),
            status=201,
        )
    except Exception as e:
        return jsonify({"error": True, "message": f"Insert failed: {e}", "result": None}), 500

@village_bp.route("/villages/<village_id>", methods=["PUT"])
def update_village(village_id):
    try:
        payload = request.get_json(force=True)
        userId = payload.get("emp_id")

        if not payload or not userId:
            return make_response(True, "Missing request body", status=400)
        payload.pop("emp_id")

        # ✅ validate partial update payload
        try:
            validated = VillageDocUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # prepare update fields
        update_fields = validated.model_dump(exclude_none=True)

        if not update_fields:
            return make_response(True, "No valid fields to update", status=400)

        # append log entry
        now = nowIST()
        log_entry = VillageLog(
            name="Village Update",
            updateTime=now,
            updateBy=userId
        ).model_dump()

        # add logs and updates
        update_doc = {
            "$set": update_fields,
            "$push": {"logs": log_entry}
        }

        result = villages.update_one(
            {"villageId": village_id, "delete": False},
            update_doc
        )

        if result.matched_count == 0:
            return make_response(True, f"Village {village_id} not found", status=404)

        return make_response(
            False,
            "Village updated successfully",
            result=None,
            status=200,
        )

    except Exception as e:
        return make_response(error=True,message=f"Update Failed {e}",result=None,status=500)

@village_bp.route("/villages/<village_id>", methods=["DELETE"])
def soft_delete_village(village_id):
    try:
        payload = request.get_json(force=True)
        userId = payload.get("emp_id")

        if not payload or not userId:
            return make_response(True, "Missing request body", status=400)

        now = nowIST()
        log_entry = VillageLog(
            name="Village Soft Delete",
            updateTime=now,
            updateBy=userId
        ).model_dump()

        update_doc = {
            "$set": {"delete": True},
            "$push": {"logs": log_entry}
        }

        result = villages.update_one({"villageId": village_id, "delete": False}, update_doc)

        if result.matched_count == 0:
            return make_response(True, f"Village {village_id} not found or already deleted", status=404)

        return make_response(
            False,
            f"Village {village_id} deleted successfully",
            result=None,
            status=200
        )

    except Exception as e:
        return make_response(True, f"Soft delete failed: {e}", result=None, status=500)
    
@village_bp.route("/villages/<village_id>/hard", methods=["DELETE"])
def hard_delete_village(village_id):
    try:
        result = villages.delete_one({"villageId": village_id})

        if result.deleted_count == 0:
            return make_response(True, f"Village {village_id} not found", status=404)

        return make_response(
            False,
            f"Village {village_id} hard deleted successfully",
            result=None,
            status=200
        )

    except Exception as e:
        return make_response(True, f"Hard delete failed: {e}", result=None, status=500)
