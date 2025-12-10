
import datetime as dt
import logging

from flask import Blueprint, logging,request, jsonify
from pydantic import ValidationError
from models.emp import UserCounters
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



@analytics_BP.route("/analytics/performance", methods=["GET"])
@auth_required
def employee_performance(decoded_data):
    try:
        error = authorizationDD(decoded_data)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        userId = request.args.get("userId")
        villageId = request.args.get("villageId")

        # -----------------------
        #  MUST HAVE at least 1
        # -----------------------
        if not userId and not villageId:
            return make_response(True, "Provide at least userId or villageId", status=400)

        # ======================================================
        #  CASE 1: userId + villageId (fetch specific village counters)
        # ======================================================
        if userId and villageId:
            emp_doc = users.find_one(
                {"userId": userId, "deleted": False},
                {"_id": 0, "name": 1, "role": 1, "userCounters": 1}
            )
            if not emp_doc:
                return make_response(True, "Employee not found", status=404)

            counters = emp_doc.get("userCounters", {})
            village_counter = counters.get(villageId, UserCounters().model_dump())

            return make_response(
                False,
                "User village performance fetched",
                result={
                    "userId": userId,
                    "villageId": villageId,
                    "name": emp_doc["name"],
                    "role": emp_doc["role"],
                    "counters": village_counter
                },
                status=200
            )

        # ======================================================
        #  CASE 2: userId ONLY → return all village counters
        # ======================================================
        if userId and not villageId:
            emp_doc = users.find_one(
                {"userId": userId, "deleted": False},
                {"_id": 0, "name": 1, "role": 1, "villageID": 1, "userCounters": 1}
            )
            if not emp_doc:
                return make_response(True, "Employee not found", status=404)

            return make_response(
                False,
                "User full performance fetched",
                result={
                    "userId": userId,
                    "name": emp_doc["name"],
                    "role": emp_doc["role"],
                    "villages": emp_doc["villageID"],
                    "counters": emp_doc.get("userCounters", {})
                },
                status=200
            )

        # ======================================================
        #  CASE 3: villageId ONLY → return performance for ALL employees
        # ======================================================
        if villageId and not userId:

            village_doc = villages.find_one(
                {"villageId": villageId, "deleted": False},
                {"_id": 0, "emp": 1}
            )
            if not village_doc:
                return make_response(True, "Village not found", status=404)

            emp_ids = village_doc.get("emp", [])
            results = []

            for uid in emp_ids:
                emp_doc = users.find_one(
                    {"userId": uid, "deleted": False},
                    {"_id": 0, "name": 1, "role": 1, "userCounters": 1}
                )
                if not emp_doc:
                    continue

                counters = emp_doc.get("userCounters", {})
                vc = counters.get(villageId, UserCounters().model_dump())

                results.append({
                    "userId": uid,
                    "name": emp_doc["name"],
                    "role": emp_doc["role"],
                    "villageId": villageId,
                    "counters": vc
                })

            return make_response(
                False,
                "Village-wide performance fetched",
                result={
                    "villageId": villageId,
                    "performance": results
                },
                status=200
            )

    except Exception as e:
        return make_response(True, f"Internal server error: {str(e)}", status=500)
