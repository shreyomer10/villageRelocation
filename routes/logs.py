
from flask import Flask, Blueprint,request

from utils.tokenAuth import auth_required
from utils.helpers import authorizationDD, make_response
from config import db

import logging

users = db.users
villages = db.villages
stages = db.stages
families = db.families

logs= db.logs

logs_bp = Blueprint("logs",__name__)


@logs_bp.route("/logs", methods=["GET"])
@auth_required
def get_logs(decoded_data):
    try:
        error = authorizationDD(decoded_data)
        if error:
            return make_response(True, message=error["message"], status=error["status"])

        args = request.args

        villageId = args.get("villageId")
        userId = args.get("userId")
        log_type = args.get("type")
        action = args.get("action")
        from_date = args.get("fromDate")
        to_date = args.get("toDate")
        relatedId=args.get("relatedId")

        page = int(args.get("page", 1))
        limit = int(args.get("limit", 20))

        if page < 1 or limit < 1:
            return make_response(True, "Invalid pagination values", status=400)

        # ---- Build query ----
        query = {}

        if villageId:
            query["villageId"] = villageId
        if userId:
            query["userId"] = userId
        if log_type:
            query["type"] = log_type
        if action:
            query["action"] = action
        if relatedId:
            query["relatedId"] = relatedId

        # ---- Date filter ----
        if from_date or to_date:
            date_filter = {}
            if from_date:
                date_filter["$gte"] = from_date
            if to_date:
                date_filter["$lte"] = to_date
            query["updateTime"] = date_filter

        # ---- Pagination ----
        skip = (page - 1) * limit

        projection = {"_id": 0}

        cursor = (
            logs.find(query, projection)
            .sort("updateTime", -1)
            .skip(skip)
            .limit(limit)
        )

        items = list(cursor)
        total_count = logs.count_documents(query)

        return make_response(
            False,
            "Logs fetched successfully",
            result={
                "count": total_count,
                "page": page,
                "limit": limit,
                "items": items,
            }
        )

    except Exception as e:
        return make_response(True, f"Error fetching logs: {str(e)}", status=500)
