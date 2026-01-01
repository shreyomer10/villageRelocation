

import datetime as dt
import logging

from flask import  Blueprint, logging,request, jsonify
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from models.village import Logs
from utils.tokenAuth import auth_required
from models.counters import get_next_family_update_id, get_next_member_update_id
from utils.helpers import STATUS_TRANSITIONS, authorization, make_response, nowIST, validation_error_response
from models.family import StatusHistory, Updates, UpdatesInsert, UpdatesUpdate
from config import JWT_EXPIRE_MIN, db

from pymongo import errors  
from pymongo import errors  

families = db.testing
options = db.options
updates=db.optionUpdates
logs=db.logs
option_verification_BP = Blueprint("optionsVerification",__name__)


#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
@option_verification_BP.route("/family_updates/insert/<familyId>", methods=["POST"])
@auth_required
def insert_family_update(decoded_data,familyId):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing userId or req body", status=400)
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        try:
            verification_obj = UpdatesInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        family = families.find_one({"familyId": familyId}, {"_id": 0})
        if not family:
            return make_response(True, "Family not found", status=404)

        fam = family


        # 2️⃣ Fetch option details
        option = options.find_one({"optionId": fam.get("relocationOption"),"deleted":False}, {"_id": 0})
        if not option:
            return make_response(True, "Relocation option not found", status=404)

        stages = [s for s in option.get("stages", []) if not s.get("deleted", False)]
        stage_ids = [s["stageId"] for s in stages]
       
        current_stage = verification_obj.currentStage
        if current_stage not in stage_ids:
            return make_response(True, f"Invalid stageId: {current_stage}", status=400)

        stagesCompleted = fam.get("stagesCompleted", [])
        current_index = stage_ids.index(current_stage)

        # Collect all stages before this one
        required_stages = stage_ids[:current_index]

        # 3️⃣ Determine required stage
        missing_stages = [s for s in required_stages if s not in stagesCompleted]
        if missing_stages:
            missing_names = [
                stage["name"] for stage in stages if stage["stageId"] in missing_stages
            ]
            return make_response(
                True,
                f"Cannot verify {current_stage} yet. Missing previous stages: {', '.join(missing_names)}",
                status=400,
            )

        # 4️⃣ Generate updateId
        update_id = get_next_family_update_id(
            db, fam.get("villageId"), option["optionId"]
        )
        now = nowIST()
        history=StatusHistory(
            status=1,
            comments=verification_obj.notes,
            verifier=userId,
            time=str(now)
        )
        # 5️⃣ Create Updates entry
        fam_update = Updates(
            villageId=fam.get("villageId"),
            familyId=familyId,
            updateId=update_id,
            status=1,
            verifiedBy=userId,
            insertedBy=userId,
            verifiedAt=str(now),
            insertedAt=str(now),

            statusHistory=[history.model_dump()],
            **verification_obj.model_dump(exclude_none=True)
        )

        # 6️⃣ Insert into DB
        families.update_one(
            {"familyId": familyId},
            {
                #"$push": {"updates": fam_update.model_dump(exclude_none=True)},
                "$addToSet": {"stagesCompleted": current_stage},
                "$set": {"currentStage": current_stage},  # ✅ maintain currentStage

            },
        )
        updates.insert_one(
            fam_update.model_dump(exclude_none=True)
        )
        log=Logs(
            userId=userId,
            updateTime=nowIST(),
            type='Families',
            action='Verification Insert',
            comments="",
            relatedId=update_id,
            villageId=fam.get("villageId")
        )

        # Insert into DB
        logs.insert_one(log.model_dump())
        return make_response(
            False,
            f"Family update {update_id} inserted successfully",
            result=fam_update.model_dump(),
            status=200
        )

    except ValidationError as ve:
        return validation_error_response(ve)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)


@option_verification_BP.route("/family_updates/<familyId>/<updateId>", methods=["PUT"])
@auth_required
def update_family_update(decoded_data,familyId, updateId):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing request body or userId", status=400)
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        try:
            update_obj = UpdatesUpdate(**payload)  # similar to VillageUpdatesUpdate
        except ValidationError as ve:
            return validation_error_response(ve)

        # # Fetch family document
        # family_doc = families.find_one({"familyId": familyId})
        # if not family_doc:
        #     return make_response(True, "Family not found", status=404)


        update_item = updates.find_one({"familyId":familyId,"updateId":updateId}, {"_id": 0})

        if not update_item:
            return make_response(True, "Update not found", status=404)
        villageId=update_item.get("villageId")
        # if update_item.get("deleted", False):
        #     return make_response(True, "Cannot update deleted update", status=400)
        previous_status = update_item.get("status", 1) 
        if previous_status >=3:
            return make_response(True, "Cannot update freezed", status=400)

        # Stage/subStage should not be changed
        # if update_obj.currentStage and update_obj.currentStage != update_item.get("currentStage"):
        #     return make_response(True, "Updating currentStage not allowed", status=400)

        # Build updated dictionary
        now = nowIST()
        update_dict = update_obj.model_dump(exclude_none=True)
        update_dict.update({"verifiedAt": now, "verifiedBy": userId})

        # # Update the specific update inside the updates array
        # families.update_one(
        #     {"familyId": familyId, "updates.updateId": updateId},
        #     {"$set": {f"updates.$.{k}": v for k, v in update_dict.items()}}
        # )

        history=StatusHistory(
            status=1,
            comments=update_dict.notes,
            verifier=userId,
            time=str(now)
        )
        updates.update_one(
            {"updateId":updateId,"familyId":familyId},
            {"$set":update_dict,
            "$push": {"statusHistory": history.model_dump(exclude_none=True)}}
        )

        # Optional: Recompute currentStage if needed
        # If the update being modified changes its status, you may want to recompute
        # family_doc["currentStage"] = max of all verified updates in order of option stages
        log=Logs(
            userId=userId,
            updateTime=nowIST(),
            type='Families',
            action='Verification Edited',
            comments="",
            relatedId=updateId,
            villageId=villageId
        )

        # Insert into DB
        logs.insert_one(log.model_dump())
        return make_response(
            False,
            f"Family update {updateId} modified successfully",
            result=update_dict,
            status=200
        )

    except ValidationError as ve:
        return validation_error_response(ve)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)

@option_verification_BP.route("/updates/delete", methods=["DELETE"])
@auth_required
def delete_update(decoded_data):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        familyId = payload.get("familyId")
        updateId = payload.get("updateId")
        userId = payload.get("userId")

        if not all([ familyId, updateId, userId]):
            return make_response(True, "Missing required fields", status=400)
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])

        
        update_item = updates.find_one({"familyId":familyId,"updateId":updateId}, {"_id": 0})

        if not update_item:
            return make_response(True, "Update not found", status=404)
        villageId=update_item.get("villageId")
        previous_status = update_item.get("status", 1) 
        if previous_status >=2:
            return make_response(True, "Cannot delete freezed verifications.", status=400)
        stage_to_remove = update_item.get("currentStage")

        # Count non-deleted updates for this stage
        non_deleted_count = updates.count_documents({
            "familyId": familyId,
            "currentStage": stage_to_remove
        })

        update_ops={}
        #update_ops = {"$set": {"updates.$.deleted": True}}


        remaining_updates = list(
            updates.find(
                {
                    "familyId": familyId,
                    "updateId": {"$ne": updateId}
                },
                {"currentStage": 1, "verifiedAt": 1, "_id": 0}
            ).sort("verifiedAt", 1)  # sort by time or insertion order if available
        )

        # 2️⃣ Determine the latest currentStage from the remaining updates
        new_current_stage = remaining_updates[-1]["currentStage"] if remaining_updates else None
        if non_deleted_count == 1:
            update_ops["$pull"] = {"stagesCompleted": stage_to_remove}
            update_ops["$set"]={"currentStage":new_current_stage}

        families.update_one(
            {"familyId": familyId},
            update_ops
        )
        updates.delete_one(
            {"updateId": updateId}
        )
        log=Logs(
            userId=userId,
            updateTime=nowIST(),
            type='Families',
            action='Verification Deleted',
            comments="",
            relatedId=updateId,
            villageId=villageId
        )

        # Insert into DB
        logs.insert_one(log.model_dump())
        return make_response(False, f" update {updateId} deleted successfully")

    except Exception as e:
        return make_response(True, f"Error deleting update: {str(e)}", status=500)


@option_verification_BP.route("/updates/verify", methods=["POST"])
@auth_required
def verify_update(decoded_data):
    try:
        payload = request.get_json(force=True)
        familyId = payload.get("familyId")
        updateId = payload.get("updateId")
        userId = payload.get("userId")
        status = payload.get("status")  # 1=accept, -1=send back
        comments = payload.get("comments", "")


        if not familyId or not updateId or not userId or not comments or status not in [1, -1]:
            return make_response(True, "Missing required fields", status=400)
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        user_role = decoded_data.get("role")

        update = updates.find_one({"familyId":familyId,"updateId":updateId}, {"_id": 0})

        if not update:
            return make_response(True, "Update not found", status=404)
        villageId=update.get("villageId")
        previous_status = update.get("status", 1) 
        
        required_status = STATUS_TRANSITIONS.get(user_role)
        if not required_status or previous_status != required_status:
            return make_response(True, f"Unauthorized: {user_role} cannot verify status {previous_status}", status=403)


        # Update status
        now = nowIST()
        final_status = min(max(previous_status + status, 1), 4)
        new_history=StatusHistory(
            status=1,
            comments=comments,
            verifier=userId,
            time=str(now)
        )


        updates.update_one(
            {"updateId": updateId, "familyId": familyId},
            {
                "$set": {
                    "status": final_status,
                    "verifiedBy": userId,
                    "verifiedAt": now,
                },
                "$push": {"statusHistory": new_history.model_dump(exclude_none=True)}
            },
            upsert=False
        )
        log=Logs(
            userId=userId,
            updateTime=nowIST(),
            type='Families',
            action='Action',
            comments=comments,
            relatedId=updateId,
            villageId=villageId
        )

        # Insert into DB
        logs.insert_one(log.model_dump())
        return make_response(False, "Verification status updated successfully", result=new_history.model_dump())

    except Exception as e:
        return make_response(True, f"Error verifying update: {str(e)}", status=500)


@option_verification_BP.route("/updates/one/<updateId>", methods=["GET"])
@auth_required
def get_update(decoded_data,updateId):

    try:

        # 2️⃣ Determine updates source
        update = updates.find_one({"updateId":updateId}, {"_id": 0})

        # 3️⃣ Return response
        if not update:
            msg = " Update not found"
            return make_response(True, msg,status=404)

        return make_response(
            False,
            "Update fetched successfully",
            result=update
        )

    except Exception as e:
        return make_response(True, f"Error fetching updates: {str(e)}", status=500)


@option_verification_BP.route("/updates/<villageId>/<familyId>", methods=["GET"])
@auth_required
def get_updates(decoded_data, villageId, familyId):
    try:
        args = request.args
        # Extract filters
        current_stage = args.get("currentStage")
        status = args.get("status")
        from_date = args.get("fromDate")
        to_date = args.get("toDate")
        user_role = decoded_data.get("role")
        name=args.get("name")
        page = int(args.get("page", 1))
        limit = int(args.get("limit", 15))

        # Build query
        query = {"villageId": villageId, "familyId": familyId}

        if current_stage:
            query["currentStage"] = current_stage
        if name:
            query["name"] = {"$regex": name, "$options": "i"}
        if status:
            query["status"] = int(status)
        elif user_role and user_role.lower() in STATUS_TRANSITIONS:
            query["status"] = STATUS_TRANSITIONS[user_role.lower()]

        # Date filtering
        if from_date or to_date:
            date_filter = {}
            if from_date:
                date_filter["$gte"] = from_date
            if to_date:
                date_filter["$lte"] = to_date
            query["insertedAt"] = date_filter

        projection = {"_id": 0, "statusHistory": 0}
        skip = (page - 1) * limit

        cursor = (
            updates.find(query, projection)
            .sort("insertedAt", -1)
            .skip(skip)
            .limit(limit)
        )

        update_items = list(cursor)
        total_count = updates.count_documents(query)

        if not update_items:
            return make_response(
                True,
                f"No updates found for family {familyId} in village {villageId}",
                result={"count": 0, "items": []},
                status=404,
            )

        return make_response(
            False,
            "Updates fetched successfully",
            result={
                "count": total_count,
                "page": page,
                "limit": limit,
                "items": update_items,
            },
        )

    except Exception as e:
        return make_response(
            True,
            f"Error fetching updates: {str(e)}",
            result={"count": 0, "items": []},
            status=500,
        )
