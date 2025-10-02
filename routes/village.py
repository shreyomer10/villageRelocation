
import datetime as dt
from flask import Flask, Blueprint, logging,request, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from utils.helpers import make_response
from models.village import FamilyCount, SubStage, Village, VillageCard
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
            "result":None
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
        return make_response(error=True,message= str(e),result=None,status=500)




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

