
import datetime as dt
import logging

from flask import Flask, Blueprint, logging,request, jsonify,make_response
from flask_cors import CORS
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from models.family import Family, FamilyCard
from config import JWT_EXPIRE_MIN, db



users = db.users
villages = db.villages
stages = db.stages
families = db.families
family_bp = Blueprint("family",__name__)



@family_bp.route("/villages/<village_id>/beneficiaries", methods=["GET"])
def get_beneficiaries(village_id):
    try:
        option = request.args.get("option")  # '1' or '2'
        q = {"villageId": village_id}  # now same name as in Mongo

        if option in {"1", "2"}:
            q["relocationOption"] = int(option)

        projection = {
            "_id": 0,
            "familyId": 1,
            "mukhiyaName": 1,
            "mukhiyaPhoto": 1,
            "relocationOption": 1,
        }

        cursor = families.find(q, projection).sort("mukhiyaName", ASCENDING)

        results = []
        for doc in cursor:
            try:
                card = FamilyCard.from_mongo(doc)
                results.append(card.model_dump(mode="json"))
            except Exception as ve:
                logging.error(f"FamilyCard validation failed: {ve}")
                continue

        return jsonify({
            "error":False,
            "message":"benifeceries fetched Successfully",
            "result":results
        }), 200

    except Exception as e:
        #logging.exception("Error fetching beneficiaries")
        return jsonify({
            "error": True, 
            "message": str(e),
            "result":None
        }), 500




@family_bp.route("/families/<family_id>", methods=["GET"])
def get_family_data(family_id):
    try:
        f = families.find_one({"familyId": family_id}, {"_id": 0})
        if not f:
            return jsonify({"error": "Family not found"}), 404

        # validate with Pydantic
        family = Family.from_mongo(f)

        return jsonify({
            "error":False,
            "message":"Fetched Successfully",
            "result":family.model_dump(mode="json")
        }), 200

    except ValidationError as ve:
        logging.error(f"Family validation failed: {ve}")
        return jsonify({
            "error": True, 
            "message": str(ve),
            "result":None
        }), 500

    except Exception as e:
        #logging.exception("Error fetching family")
        return jsonify({
            "error": True, 
            "message": str(e),
            "result":None
        }), 500
