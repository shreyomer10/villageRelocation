
import datetime as dt
import logging

from flask import Blueprint, logging,request, jsonify
from pydantic import ValidationError
from models.village import FamilyCount
from utils.helpers import make_response
from config import  db

from pymongo import errors  
buildings = db.buildings
villages = db.villages
plots = db.plots
families = db.testing
options = db.options

analytics_BP = Blueprint("analytics",__name__)


@analytics_BP.route("/analytics/options/<option_id>", methods=["GET"])
def get_option_analytics(option_id):
    try:
        if not option_id or not isinstance(option_id, str):
            return make_response(True, "Invalid or missing option_id", status=400)

        village_id = request.args.get("villageId")

        # -------- Fetch Option -------- #
        try:
            option_doc = options.find_one(
                {"optionId": option_id, "deleted": False},
                {"_id": 0, "stages": 1, "name": 1}
            )
        except Exception as e:
            return make_response(True, f"Database error fetching option: {str(e)}", status=500)

        if not option_doc:
            return make_response(True, "Option not found", status=404)

        option_name = option_doc.get("name", "Unknown Option")
        stages = option_doc.get("stages", [])
        if not stages:
            return make_response(True, "No stages found for this option", status=404)

        # -------- Initialize stage counters -------- #
        stage_counters = [{"id": stage.get("stageId"), "name": stage.get("name"), "count": 0} for stage in stages]

        # -------- Prepare Family Query -------- #
        query = {}
        if village_id:
            query["villageId"] = village_id

        # -------- Fetch Families -------- #
        try:
            family_cursor = families.find(query, {"_id": 0, "currentStage": 1})
        except Exception as e:
            return make_response(True, f"Database error fetching families: {str(e)}", status=500)

        # -------- Increment stage counters -------- #
        for fam in family_cursor:
            fam_stage = fam.get("currentStage")
            for stage in stage_counters:
                if stage["id"] == fam_stage:  # increment only if currentStage matches stage name
                    stage["count"] += 1

        # -------- Response -------- #
        result = {
            "optionId": option_id,
            "optionName": option_name,
            "stages": stage_counters
        }

        return make_response(False, "Analytics fetched successfully", result=result, status=200)

    except Exception as e:
        return make_response(True, f"Internal server error: {str(e)}", status=500)


@analytics_BP.route("/villages/family-count", defaults={"village_id": None}, methods=["GET"])
@analytics_BP.route("/villages/<village_id>/family-count", methods=["GET"])
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
