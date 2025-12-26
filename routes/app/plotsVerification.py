
import datetime as dt
from flask import Blueprint,request, jsonify
from pydantic import ValidationError
from models.complaints import StatusHistory
from utils.tokenAuth import auth_required
from models.stages import FieldLevelVerification, FieldLevelVerificationInsert, FieldLevelVerificationUpdate, House, HouseInsert, Plots, PlotsInsert, PlotsUpdate, statusHistory
from models.counters import get_next_house_id, get_next_plot_id, get_next_verification_id
from utils.helpers import STATUS_TRANSITIONS, authorization, make_response, nowIST, str_to_ist_datetime, validation_error_response
from config import  db
from pymongo import UpdateOne
from config import client
from pymongo import errors  

houses=db.house
buildings = db.buildings
villages = db.villages
plots = db.plots
families = db.testing

updates=db.plotUpdates

plots_verification_BP = Blueprint("plots_verification",__name__)


# ------------------ FIELD LEVEL VERIFICATION ------------------



@plots_verification_BP.route("/field_verification/insert/<plotId>", methods=["POST"])
@auth_required
def insert_verification(decoded_data, plotId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        type_ = payload.pop("type", None)  # 'house' or 'plot'
        homeId = request.args.get("homeId")
        userId = payload.pop("userId", None)

        if not type_ or type_ not in ["house", "plot"]:
            return make_response(True, "Invalid or missing type (must be 'house' or 'plot')", status=400)
        if type_ == "house" and not homeId:
            return make_response(True, "homeId not provided for house verification", status=400)
        if not userId:
            return make_response(True, "Missing userId", status=400)

        # ✅ Authorization check
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, error["message"], status=error["status"])

        # ✅ Validate payload schema
        try:
            verification_obj = FieldLevelVerificationInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # ✅ Fetch target entity
        if type_ == "house":
            target = houses.find_one({"plotId": plotId, "deleted": False})
        else:
            target = plots.find_one({"plotId": plotId, "deleted": False})

        if not target:
            return make_response(True, f"{'House' if type_ == 'house' else 'Plot'} not found", status=404)

        # ✅ Get type & village for stage structure
        villageId = target["villageId"]
        typeId = target["typeId"]

        building = buildings.find_one({"typeId": typeId, "villageId": villageId, "deleted": False})
        if not building:
            return make_response(True, "Building type not found", status=404)

        stages = [s for s in building.get("stages", []) if not s.get("deleted", False)]
        stage_ids = [s["stageId"] for s in stages]

        current_stage = verification_obj.currentStage
        if current_stage not in stage_ids:
            return make_response(True, f"Invalid stageId: {current_stage}", status=400)

        # ✅ Check stage dependencies
        if type_ == "house":
            home = next((h for h in target.get("homeDetails", []) if h.get("homeId") == homeId), None)
            if not home:
                return make_response(True, f"Home with homeId '{homeId}' not found in this plot", status=404)
            completed_stages = home.get("stagesCompleted", [])
        else:
            completed_stages = target.get("stagesCompleted", [])

        current_index = stage_ids.index(current_stage)
        required_stages = stage_ids[:current_index]
        missing_stages = [s for s in required_stages if s not in completed_stages]

        if missing_stages:
            missing_names = [stage["name"] for stage in stages if stage["stageId"] in missing_stages]
            return make_response(True, f"Cannot verify {current_stage}. Missing previous: {', '.join(missing_names)}", status=400)

        # ✅ Passed validation → Create verification record
        new_verification_id = get_next_verification_id(db, villageId, typeId)
        now = nowIST()
        history = statusHistory(
            status=1,
            comments=verification_obj.notes,
            verifier=userId,
            time=str(now)
        )
        #print("OK")

        verification_doc = FieldLevelVerification(
            type=type_,
            villageId=villageId,
            plotId=plotId,
            homeId=homeId if type_ == "house" else None,
            status=1,
            verificationId=new_verification_id,
            verifiedAt=str(now),
            verifiedBy=userId,
            insertedBy=userId,
            insertedAt=str(now),
            statusHistory=[history.model_dump()],  # ✅ Important fix
            **verification_obj.model_dump(exclude_none=True)
        )

        updates.insert_one(verification_doc.model_dump(exclude_none=True))
        #print("OK hai yaha tak")
        # ✅ Update the related entity (house or plot)
        if type_ == "house":
            houses.update_one(
                {"plotId": plotId, "homeDetails.homeId": homeId},
                {
                    "$set": {
                        "homeDetails.$.currentStage": current_stage
                    },
                    "$addToSet": {
                        "homeDetails.$.stagesCompleted": current_stage
                    }
                },
            )
        else:
            plots.update_one(
                {"plotId": plotId},
                {
                    "$set": {"currentStage": current_stage},
                    "$addToSet": {"stagesCompleted": current_stage},
                },
            )
        #print("OK")

        return make_response(
            False,
            f"Verification for {type_} inserted successfully",
            result=verification_doc.model_dump(exclude_none=True),
        )

    except Exception as e:
        return make_response(True, f"Error inserting verification: {str(e)}", status=500)


@plots_verification_BP.route("/field_verification/<plotId>/<verificationId>", methods=["PUT"])
@auth_required
def update_verification(decoded_data,plotId, verificationId):
    try:
        payload = request.get_json(force=True)
        if not payload :
            return make_response(True, "Missing request body", status=400)
        type_ = payload.pop("type", None)  # 'house' or 'plot'
        homeId = request.args.get("homeId")
        userId = payload.pop("userId", None)

        if not type_ or type_ not in ["house", "plot"]:
            return make_response(True, "Invalid or missing type (must be 'house' or 'plot')", status=400)
        if type_ == "house" and not homeId:
            return make_response(True, "homeId not provided for house verification", status=400)
        if not userId:
            return make_response(True, "Missing userId", status=400)

        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])

        try:
            verification_obj = FieldLevelVerificationUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)


        if type_ == "house":

            update_item = updates.find_one({"verificationId":verificationId,"plotId":plotId,"homeId":homeId}, {"_id": 0})
        else:
            update_item = updates.find_one({"verificationId":verificationId,"plotId":plotId}, {"_id": 0})

        if not update_item:
            return make_response(True, "Update not found", status=404)

        previous_status = update_item.get("status", 1) 
        if previous_status >=3:
            return make_response(True, "Cannot update freezed", status=400)

        now = nowIST()

        update_dict = verification_obj.model_dump(exclude_none=True)
        update_dict.update({"verifiedAt": now,"verifiedBy": userId})
        history=statusHistory(
            status=1,
            comments=verification_obj.notes,
            verifier=userId,
            time=str(now)
        )
        # Perform the update
        updates.update_one(
            {"verificationId":verificationId,"plotId":plotId},
            {"$set":update_dict,
            "$push": {"statusHistory": history.model_dump(exclude_none=True)}}
        )
        return make_response(False, "Verification updated successfully", result=update_dict)
    except Exception as e:
        return make_response(True, f"Error updating verification: {str(e)}", status=500)

@plots_verification_BP.route("/field_verification/verify", methods=["POST"])
@auth_required
def verify_verification(decoded_data):
    try:
    
        payload = request.get_json(force=True)
        plotId = payload.get("plotId")
        verificationId = payload.get("verificationId")
        userId = payload.get("userId")
        status = payload.get("status")  # 1 = accept, -1 = send back
        comments = payload.get("comments", "")

        if not userId or not comments or not plotId or not verificationId or not comments or status not in [1, -1]:
            return make_response(True, "Missing userId ,comments,verificationId , plotId or invalid status (must be 1 or -1)", status=400)
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])

        user_role = decoded_data.get("role")

        verification = updates.find_one({"plotId":plotId,"verificationId":verificationId}, {"_id": 0})

        if not verification:
            return make_response(True, "verification not found", status=404)
        previous_status = verification.get("status", 1) 
        
        required_status = STATUS_TRANSITIONS.get(user_role)
        if not required_status or previous_status != required_status:
            return make_response(True, f"Unauthorized: {user_role} cannot verify status {previous_status}", status=403)

        final_status = min(max(previous_status + status, 1), 4)

        now = nowIST()
        new_history=statusHistory(
            status=final_status,
            comments=comments,
            verifier=userId,
            time=str(now)
        )


        updates.update_one(
            {"verificationId": verificationId, "plotId": plotId},
            {
                "$set": {
                    "status":final_status,
                    "verifiedBy": userId,
                    "verifiedAt": now,
                },
                "$push": {"statusHistory": new_history.model_dump(exclude_none=True)}
            },
            upsert=False

        )

        return make_response(False, "Verification status updated successfully", result=new_history.model_dump())

    except Exception as e:
        return make_response(True, f"Error verifying verification: {str(e)}", status=500)


@plots_verification_BP.route("/field_verification/<plotId>/<verificationId>", methods=["DELETE"])
@auth_required
def delete_verification(decoded_data,plotId, verificationId):
    try:
        payload = request.get_json(force=True)
        userId = payload.get("userId") 

        if not payload or not userId:
            return make_response(True, "Request body missing", status=400)

        comments = payload.get("comments", f"Deleted by user{userId}") if payload else "Deleted by user"
        type_ = payload.pop("type", None)  # 'house' or 'plot'
        homeId = request.args.get("homeId")
        if not type_ or type_ not in ["house", "plot"]:
            return make_response(True, "Invalid or missing type (must be 'house' or 'plot')", status=400)
        if type_ == "house" and not homeId:
            return make_response(True, "homeId not provided for house verification", status=400)

        if not userId:
            return make_response(True, "Missing userId in request body", status=400)
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])

        # plot = plots.find_one({"plotId": plotId, "deleted": False})
        # if not plot:
        #     return make_response(True, "Plot not found", status=404)

        verification = updates.find_one({"plotId":plotId,"verificationId":verificationId}, {"_id": 0})
        if not verification:
            return make_response(True, "Verification not found", status=404)
        previous_status = verification.get("status", 1) 
        if previous_status >=2:
            return make_response(True, "Cannot update freezed verifications.", status=400)
        
        stage_to_remove = verification.get("currentStage")
        if type_ == "house":
            non_deleted_count = updates.count_documents({
                "plotId": plotId,
                "homeId":homeId,
                "currentStage": stage_to_remove
            })
        else:
            non_deleted_count = updates.count_documents({
                "plotId": plotId,
                "currentStage": stage_to_remove
            })
        update_ops={}


        remaining_updates = list(
            updates.find(
                {
                    "plotId": plotId,
                    "verificationId": {"$ne": verificationId}
                },
                {"currentStage": 1, "verifiedAt": 1, "_id": 0}
            ).sort("verifiedAt", 1)  # sort by time or insertion order if available
        )
        new_current_stage = remaining_updates[-1]["currentStage"] if remaining_updates else None

        if non_deleted_count == 1:
            update_ops["$pull"] = {"stagesCompleted": stage_to_remove}
            update_ops["$set"]={"currentStage":new_current_stage}
        if type_ == "house":
            houses.update_one(
                {"plotId": plotId, "homeDetails.homeId": homeId},
                {
                    "$set": {
                        "homeDetails.$.currentStage": new_current_stage
                    },
                    "$pull": {
                        "homeDetails.$.stagesCompleted": stage_to_remove
                    }
                }
            )

        else:
            plots.update_one(
                {"plotId":plotId},
                update_ops,
                upsert=False
            )
        updates.delete_one(
            {"verificationId": verificationId}
        )

        return make_response(False, "Verification deleted successfully")

    except Exception as e:
        return make_response(True, f"Error deleting verification: {str(e)}", status=500)


@plots_verification_BP.route("/field_verification/one/<verificationId>", methods=["GET"])
@auth_required
def get_verification(decoded_data,verificationId):
    try:
        verification = updates.find_one({"verificationId": verificationId}, {"_id": 0})

        if not verification:
            return make_response(True, "verification not found",result=None, status=404)

        return make_response(False, "Verification fetched successfully", result=verification,status=200)
    except Exception as e:
        return make_response(True, f"Error fetching verification: {str(e)}", result=None,status=500)


@plots_verification_BP.route("/field_verification/<villageId>/<plotId>", methods=["GET"])
@auth_required
def get_field_verifications(decoded_data,villageId,plotId):
    try:
        # --- Extract query parameters ---
        args = request.args
        current_stage = args.get("currentStage")
        home_id = args.get("homeId")
        status = args.get("status")
        name = args.get("name")

        user_role = decoded_data.get("role")  # Optional user role/status
        from_date = args.get("fromDate")
        to_date = args.get("toDate")
        page = int(args.get("page", 1))
        limit = int(args.get("limit", 15))
        # --- Build MongoDB filter query dynamically ---
        query = {"plotId": plotId,"villageId":villageId}

        if current_stage:
            query["currentStage"] = current_stage
        if name:
            query["name"] = {"$regex": name, "$options": "i"}
        if home_id:
            query["homeId"] = home_id
        if status:
            query["status"] = int(status)
        elif user_role in STATUS_TRANSITIONS:
            query["status"] = STATUS_TRANSITIONS[user_role]

        # --- Date Range Filtering ---
        if from_date or to_date:
            date_filter = {}
            if from_date:
                date_filter["$gte"] = (from_date)
            if to_date:
                date_filter["$lte"] = (to_date)
            query["insertedAt"] = date_filter

        # --- Projection (exclude heavy fields) ---
        projection = {"_id": 0, "statusHistory": 0, "docs": 0}

        # --- Sorting & Pagination ---
        skip = (page - 1) * limit

        cursor = (
            updates.find(query, projection)
            .sort("insertedAt", -1)  # latest first
            .skip(skip)
            .limit(limit)
        )

        verifications = list(cursor)
        total_count = updates.count_documents(query)

        if not verifications:
            return make_response(
                True,
                "No verifications found",
                result={"count": 0, "items": []},
                status=404,
            )

        return make_response(
            False,
            "Verifications fetched successfully",
            result={
                "count": total_count,
                "page": page,
                "limit": limit,
                "items": verifications,
            },
        )

    except ValueError as ve:
        return make_response(
            True,
            f"Invalid date format: {str(ve)}",
            result={"count": 0, "items": []},
            status=400,
        )

    except Exception as e:
        return make_response(
            True,
            f"Error fetching verifications: {str(e)}",
            result={"count": 0, "items": []},
            status=500,
        )
