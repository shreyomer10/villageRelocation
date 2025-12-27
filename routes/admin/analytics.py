
import datetime as dt
import logging

from flask import Blueprint, logging,request, jsonify
from pydantic import ValidationError
from utils.tokenAuth import auth_required
from models.village import FamilyCount
from utils.helpers import authorizationDD, make_response
from config import  db

from pymongo import errors  
buildings = db.buildings
villages = db.villages
plots = db.plots
houses=db.house
families = db.testing
options = db.options
users= db.users
logs = db.logs

analytics_BP = Blueprint("analytics",__name__)


@analytics_BP.route("/analytics/options/<option_id>", methods=["GET"])
@auth_required
def get_option_analytics(decoded_data, option_id):
    try:
        if not option_id:
            return make_response(True, "Invalid or missing option_id", status=400)

        error = authorizationDD(decoded_data)
        if error:
            return make_response(True, message=error["message"], status=error["status"])

        # Fetch option stages
        option_doc = options.find_one(
            {"optionId": option_id, "deleted": False},
            {"_id": 0, "stages": 1, "name": 1}
        )
        if not option_doc:
            return make_response(True, "Option not found", status=404)

        stages = option_doc["stages"]
        stage_map = {s["stageId"]: {"id": s["stageId"], "name": s["name"], "count": 0} for s in stages}

        # Build match query
        village_id = request.args.get("villageId")
        match_q = {}
        if village_id:
            match_q["villageId"] = village_id

        # Aggregation pipeline
        pipeline = [
            {"$match": match_q},
            {"$group": {"_id": "$currentStage", "count": {"$sum": 1}}}
        ]

        agg = families.aggregate(pipeline)

        for item in agg:
            sid = item["_id"]
            if sid in stage_map:
                stage_map[sid]["count"] = item["count"]

        return make_response(False, "Analytics fetched", 
            result={
                "optionId": option_id,
                "optionName": option_doc["name"],
                "stages": list(stage_map.values())
            },
            status=200
        )

    except Exception as e:
        return make_response(True, f"Internal server error: {str(e)}", status=500)


@analytics_BP.route("/analytics/building/<villageId>/<type_id>", methods=["GET"])
@auth_required
def get_building_analytics(decoded_data, villageId, type_id):
    try:
        mode = request.args.get("mode", "plot").lower()

        error = authorizationDD(decoded_data)
        if error:
            return make_response(True, message=error["message"], status=error["status"])

        # Load building type info
        building_doc = buildings.find_one(
            {"villageId": villageId, "typeId": type_id, "deleted": False},
            {"_id": 0, "stages": 1, "name": 1}
        )
        if not building_doc:
            return make_response(True, "Building type not found", status=404)

        stages = building_doc["stages"]
        stage_map = {s["stageId"]: {"id": s["stageId"], "name": s["name"], "count": 0} for s in stages}

        # Choose pipeline
        if mode in ["0", "plot"]:
            pipeline = [
                {"$match": {"villageId": villageId, "typeId": type_id, "deleted": False}},
                {"$group": {"_id": "$currentStage", "count": {"$sum": 1}}}
            ]

        elif mode in ["1", "house"]:
            pipeline = [
                {"$match": {"villageId": villageId, "typeId": type_id, "deleted": False}},
                {"$unwind": "$homeDetails"},
                {"$group": {"_id": "$homeDetails.currentStage", "count": {"$sum": 1}}}
            ]

        else:
            return make_response(True, "Invalid mode (plot/house)", status=400)

        agg = list((plots if mode=="plot" else houses).aggregate(pipeline))

        # Fill counts
        for x in agg:
            sid = x["_id"]
            if sid in stage_map:
                stage_map[sid]["count"] = x["count"]

        return make_response(False, "Analytics fetched",
            result={
                "typeId": type_id,
                "buildingName": building_doc["name"],
                "mode": mode,
                "stages": list(stage_map.values())
            },
            status=200
        )

    except Exception as e:
        return make_response(True, f"Internal server error: {str(e)}", status=500)
 
@analytics_BP.route("/analytics/house/<villageId>/home-count", methods=["GET"])
@auth_required
def numberOfHomes(decoded_data, villageId):
    try:
        error = authorizationDD(decoded_data)
        if error:
            return make_response(True, message=error["message"], status=error["status"])

        if not villageId:
            return make_response(True, "Missing villageId", status=400)

        # -------- AGGREGATION PIPELINE -------- #
        pipeline = [
            {"$match": {"villageId": villageId, "deleted": False}},
            {"$group": {"_id": "$numberOfHome", "count": {"$sum": 1}}}
        ]

        try:
            agg_result = list(houses.aggregate(pipeline))
        except Exception as e:
            return make_response(True, f"DB error: {str(e)}", status=500)

        # Initialize only 1,2,3
        stats = {"1": 0, "2": 0, "3": 0}

        # Map aggregation result
        for item in agg_result:
            n = item["_id"]
            c = item["count"]
            if n in [1, 2, 3]:
                stats[str(n)] = c

        result = {
            "villageId": villageId,
            "homeCountStats": stats
        }

        return make_response(False, "Home count analytics fetched", result=result, status=200)

    except Exception as e:
        return make_response(True, f"Internal server error: {str(e)}", status=500)

@analytics_BP.route("/villages/family-count", defaults={"village_id": None}, methods=["GET"])
@analytics_BP.route("/villages/<village_id>/family-count", methods=["GET"])
@auth_required
def get_family_count(decoded_data,village_id):
    try:
        error = authorizationDD(decoded_data)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
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


@analytics_BP.route("/analytics/activity", methods=["GET"])
@auth_required
def peak_activity(decoded_data):
    try:
        error = authorizationDD(decoded_data)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        args = request.args

        granularity = args.get("granularity")  # day | month
        villageId = args.get("villageId")
        userId = args.get("userId")
        from_date = args.get("fromDate")
        to_date = args.get("toDate")

        if granularity not in ["day", "month"]:
            return make_response(True, "granularity must be day or month", status=400)

        match = {}

        if villageId:
            match["villageId"] = villageId
        if userId:
            match["userId"] = userId

        if from_date or to_date:
            date_filter = {}
            if from_date:
                date_filter["$gte"] = from_date
            if to_date:
                date_filter["$lte"] = to_date
            match["updateTime"] = date_filter

        substr_len = 10 if granularity == "day" else 7  # YYYY-MM-DD / YYYY-MM

        pipeline = [
            {"$match": match},
            {
                "$group": {
                    "_id": { "$substr": ["$updateTime", 0, substr_len] },
                    "count": { "$sum": 1 }
                }
            },
            {"$sort": {"_id": 1}}
        ]

        data = list(logs.aggregate(pipeline))

        return make_response(
            False,
            "Peak activity data",
            result=data
        )

    except Exception as e:
        return make_response(True, f"Error generating peak activity: {str(e)}", status=500)


@analytics_BP.route("/analytics/user", methods=["GET"])
@auth_required
def user_breakdown(decoded_data):
    try:
        error = authorizationDD(decoded_data)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        args = request.args

        userId = args.get("userId")
        granularity = args.get("granularity")  # day | month

        if not userId:
            return make_response(True, "userId required", status=400)
        if granularity not in ["day", "month"]:
            return make_response(True, "granularity must be day or month", status=400)

        substr_len = 10 if granularity == "day" else 7
        time_key = "day" if granularity == "day" else "month"

        pipeline = [
            {"$match": {"userId": userId}},
            {
                "$group": {
                    "_id": {
                        time_key: { "$substr": ["$updateTime", 0, substr_len] },
                        "type": "$type",
                        "action": "$action"
                    },
                    "count": { "$sum": 1 }
                }
            },
            {
                "$project": {
                    "_id": 0,
                    time_key: f"$_id.{time_key}",
                    "type": "$_id.type",
                    "action": "$_id.action",
                    "count": 1
                }
            },
            {"$sort": {time_key: 1}}
        ]

        data = list(logs.aggregate(pipeline))

        return make_response(
            False,
            "User activity breakdown",
            result=data
        )

    except Exception as e:
        return make_response(True, f"Error generating breakdown: {str(e)}", status=500)
