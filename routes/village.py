
import datetime as dt
from flask import Flask, Blueprint, logging,request, jsonify,make_response
from flask_cors import CORS
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from models.village import FamilyCount, Stage, SubStage, Village, VillageCard
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
            "result":None
        }), 500

@village_bp.route("/timeline", methods=["GET"])
def get_timeline():
    try:
        cursor = stages.find({}, {"_id": 0})  # fetch all, exclude _id
        result = []

        for doc in cursor:
            try:
                # validate and parse using Pydantic
                stage = Stage.model_validate(doc)
                result.append(stage.model_dump())
            except ValidationError as ve:
                logging.error(f"Stage validation failed: {ve}")
                # skip invalid record or include an error marker
                continue  

        return jsonify({
            "error": False,
            "message": "Successfully Fetched timeline",
            "result": result
        }), 200

    except Exception as e:
        logging.exception("Error fetching timeline data")
        return jsonify({
            "error": True,
            "message": str(e),
            "result":None
        }), 500


@village_bp.route("/villages/family-count", defaults={"village_id": None}, methods=["GET"])
@village_bp.route("/villages/<village_id>/family-count", methods=["GET"])
def get_family_count(village_id):
    try:
        pipeline = []

        # Only match villageId if a specific village_id is passed
        if village_id:
            pipeline.append({"$match": {"villageId": village_id}})

        # Group by relocationOption
        pipeline.append({
            "$group": {
                "_id": "$relocationOption",
                "count": {"$sum": 1}
            }
        })

        counts = {"total": 0, "option1": 0, "option2": 0}
        for row in families.aggregate(pipeline):
            counts["total"] += row["count"]
            if row["_id"] in (1, "1", "Option1"):
                counts["option1"] = row["count"]
            elif row["_id"] in (2, "2", "Option2"):
                counts["option2"] = row["count"]

        # Use Pydantic to validate/output
        family_count = FamilyCount.from_counts(village_id or "All", counts)
        return jsonify({
            "error": False,
            "message": "Successfully Fetched Count",
            "result": family_count.model_dump()
        }), 200

    except Exception as e:
        logging.exception("Error fetching family count")
        return jsonify({
            "error": True,
            "message": str(e),
            "result": None
        }), 500

@village_bp.route("/villages/<village_id>", methods=["GET"])
def get_village_data(village_id):
    try:
        v = villages.find_one({"villageId": village_id}, {"_id": 0})
        if not v:
            return jsonify({
                "error": True,
                "message": "Not Found",
                "result": None
            }), 404

        # validate using Pydantic
        village = Village.from_mongo(v)

        # Convert HttpUrl and other types to JSON-serializable dict
        return jsonify({
            "error": False,
            "message": "Successfully fetched village",
            "result": village.model_dump(mode="json")  # model_dump() ensures HttpUrl -> str
        }), 200

    except ValidationError as ve:
        logging.error(f"Village validation failed: {ve}")
        return jsonify({
            "error": True,
            "message": f"Invalid village data: {ve}",
            "result": None
        }), 500

    except Exception as e:
        logging.exception("Error fetching village")
        return jsonify({
            "error": True,
            "message": f"Failed to fetch village: {e}",
            "result": None
        }), 500
