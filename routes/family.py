
import datetime as dt

from flask import Flask, Blueprint,request, jsonify,make_response
from flask_cors import CORS
from pymongo import  ASCENDING, DESCENDING
from config import JWT_EXPIRE_MIN, db
import jwt
from utils.helpers import hash_password,verify_password,to_village_card
from utils.tokenAuth import auth_required,make_jwt
from routes.auth import auth_bp


users = db.users
villages = db.villages
stages = db.stages
village_stage_progress = db.village_stage_progress
families = db.families
family_members = db.family_members
option1_housing = db.option1_housing
option2_fundflow = db.option2_fundflow
plan_layouts = db.plan_layouts

family_bp = Blueprint("family",__name__)
@family_bp.route("/villages/<village_id>/beneficiaries", methods=["GET"])
def get_beneficiaries(village_id):
    option = request.args.get("option")  # '1' or '2'
    q = {"village_id": village_id}
    if option in {"1", "2"}:
        # support numeric or string storage
        q["relocation_option"] = int(option)
    projection = {
        "_id": 0,
        "family_id": 1,
        "mukhiyaName": 1,
        "mukhiya_photo": 1,
    }
    cursor = families.find(q, projection=projection).sort("mukhiyaName", ASCENDING)
    results = [{
        "familyId": f.get("family_id"),
        "mukhiyaName": f.get("mukhiyaName"),
        "mukhiyaPhoto": f.get("mukhiya_photo"),
    } for f in cursor]
    return jsonify(results)


@family_bp.route("/families/<family_id>", methods=["GET"])
def get_family_data(family_id):
    f = families.find_one({"family_id": family_id}, {"_id": 0})
    if not f:
        return jsonify({"error": "Family not found"}), 404

    members = list(family_members.find({"family_id": family_id}, {"_id": 0}))

    # Option1 and Option2 progress (if any)
    o1_photos = list(option1_housing.find({"family_id": family_id}, {"_id": 0}).sort("uploaded_on", DESCENDING))
    o2_progress = list(option2_fundflow.find({"family_id": family_id}, {"_id": 0}).sort("transaction_date", DESCENDING))

    return jsonify({
        "family": {
            "familyId": f.get("family_id"),
            "villageId": f.get("village_id"),
            "mukhiyaId": f.get("mukhiyaId"),
            "mukhiyaName": f.get("mukhiyaName"),
            "mukhiyaPhoto": f.get("mukhiya_photo"),
            "relocationOption": f.get("relocation_option"),
            "createdAt": f.get("created_at"),
            "updatedAt": f.get("updated_at"),
        },
        "members": members,
        "option1Housing": o1_photos,
        "option2FundFlow": o2_progress,
    })
