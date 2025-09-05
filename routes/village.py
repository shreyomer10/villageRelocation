
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

village_bp = Blueprint("village",__name__)

@village_bp.route("/villages", methods=["GET"])
def get_all_villages():
    """Dashboard list with optional stage filter (?stage=3 or ?stage=2,3)."""
    stage = request.args.get("stage")
    q = {}
    if stage:
        try:
            # allow comma-separated list
            stages_filter = [int(s.strip()) for s in stage.split(",") if s.strip().isdigit()]
            if stages_filter:
                q["current_stage"] = {"$in": stages_filter}
        except Exception:
            pass
    cursor = villages.find(q, projection={"_id": 0, "village_id": 1, "name": 1, "current_stage": 1, "updated_at": 1}).sort("name", ASCENDING)
    return jsonify([to_village_card(v) for v in cursor])


@village_bp.route("/villages/<village_id>/family-count", methods=["GET"])
def get_family_count(village_id):
    pipeline = [
        {"$match": {"village_id": village_id}},
        {"$group": {
            "_id": "$relocation_option",
            "count": {"$sum": 1}
        }}
    ]
    counts = {"total": 0, "option1": 0, "option2": 0}
    for row in families.aggregate(pipeline):
        counts["total"] += row["count"]
        if row["_id"] == 1 or row["_id"] == "1" or row["_id"] == "Option1":
            counts["option1"] = row["count"]
        elif row["_id"] == 2 or row["_id"] == "2" or row["_id"] == "Option2":
            counts["option2"] = row["count"]
    return jsonify({
        "villageId": village_id,
        "totalFamilies": counts["total"],
        "familiesOption1": counts["option1"],
        "familiesOption2": counts["option2"],
    })


@village_bp.route("/villages/<village_id>", methods=["GET"])
def get_village_data(village_id):
    v = villages.find_one({"village_id": village_id}, {"_id": 0})
    if not v:
        return jsonify({"error": "Village not found"}), 404

    # Compute total stages from stages collection if not set
    total_stages = v.get("total_stages")
    if not total_stages:
        total_stages = stages.count_documents({})

    data = {
        "villageId": v.get("village_id"),
        "name": v.get("name"),
        "currentStage": v.get("current_stage"),
        "totalStages": total_stages,
        "lastUpdatedOn": v.get("updated_at"),
        "location": {
            "latitude": v.get("location_latitude"),
            "longitude": v.get("location_longitude"),
        },
        "areaOfRelocation": v.get("area_of_relocation"),
        "areaDiverted": v.get("area_diverted"),
        "image": v.get("photo"),
    }
    return jsonify(data)
