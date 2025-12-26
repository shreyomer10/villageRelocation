from flask import Blueprint, Config,request
from models.maati import SystemType
from utils.tokenAuth import auth_required
from utils.helpers import authorizationDD, detect_system_from_ua, make_response, nowIST
from config import  db

admin=db.admin
admin_BP = Blueprint("admin",__name__)

from datetime import datetime, timezone

@admin_BP.route("/config", methods=["POST"])
@auth_required
def update_system_config(decoded_data):
    try:
        payload = request.get_json(force=True)

        error = authorizationDD(decoded_data)
        if error:
            return make_response(True, error["message"], status=error["status"])

        system = payload.get("system")
        if not system:
            return make_response(True, "system is required", status=400)

        # Validate with Pydantic
        system_cfg = SystemType(
            system=system,
            maintenance=payload.get("maintenance", False),
            version=payload.get("version", ""),
            message=payload.get("message", ""),
            updatedAt=nowIST()
        )
        db.admin.update_one(
            {"_id": system},   # android / ios / web / backend
            {
                "$set": system_cfg.dict()
            },
            upsert=True
        )


        return make_response(False, "System config updated", result=system_cfg.dict(), status=200)

    except Exception as e:
        return make_response(True, str(e), status=500)


@admin_BP.route("/config", methods=["GET"])
def get_system_config():
    try:
        system = request.args.get("system")

        # Fallback to User-Agent
        if not system:
            ua = request.headers.get("User-Agent", "")
            system = detect_system_from_ua(ua)

        # ---- If system detected → return single config ----
        if system:
            doc = db.admin.find_one({"_id": system}, {"_id": 0})
            if not doc:
                return make_response(True, "System config not found", status=404)

            return make_response(
                False,
                f"{system} config fetched",
                result=doc,
                status=200
            )

        # ---- No system → return all configs ----
        docs = list(db.admin.find({}, {"_id": 0}))
        return make_response(
            False,
            "All system configs fetched",
            result=docs,
            status=200
        )

    except Exception as e:
        return make_response(True, str(e), status=500)
