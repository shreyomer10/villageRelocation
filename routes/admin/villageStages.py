
import datetime as dt
import logging

from flask import Blueprint, logging,request, jsonify
from pydantic import ValidationError
from models.village import StageInsert,Stages,SubStage,SubStageInsert,SubStageUpdate,StageUpdate, VillageUpdates, VillageUpdatesInsert, VillageUpdatesUpdate
from models.counters import get_next_villageStage_id, get_next_villageStageUpdate_id, get_next_villageSubStage_id
from utils.helpers import make_response, validation_error_response
from config import  db

from pymongo import errors  
buildings = db.buildings
villages = db.villages
plots = db.plots
families = db.testing
#stages = db.stages
stages = db.teststages

villageStages_BP = Blueprint("villageStages",__name__)

from datetime import datetime
from pymongo import ReturnDocument

#dashboard overall stages and substages 



@villageStages_BP.route("/stages/insert", methods=["POST"])
def insert_stage():
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        # Validate input
        try:
            option_obj = StageInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)


        total_stages = stages.count_documents({"deleted": False})
        pos = option_obj.position if option_obj.position is not None else total_stages

        if pos < 0 or pos > total_stages:
            return make_response(True, f"Position must be between 0 and {total_stages}", status=400)

        # Generate new optionId (sequence or custom logic)
        new_option_id = get_next_villageStage_id(db)


        # ✅ Generate stageIds and validate with BuildingStages model
        stages_with_id = []
        for stage in option_obj.stages:
            stage_id = get_next_villageSubStage_id(db, new_option_id)
            stage_full = SubStage(
                subStageId=stage_id,
                **stage.model_dump(exclude_none=True)
            )
            stages_with_id.append(stage_full)

        # ✅ Build Building object with IDs
        option_complete = Stages(
            stageId=new_option_id,
            name=option_obj.name,
            desc=option_obj.desc,
            stages=stages_with_id,
            deleted=False,
            position=pos

        )
        stages.update_many(
            {"deleted": False, "position": {"$gte": pos}},
            {"$inc": {"position": 1}}
        )
        # ✅ Properly dump nested models
        option_dict = option_complete.model_dump(exclude_none=True)
        option_dict["stages"] = [s.model_dump(exclude_none=True) for s in stages_with_id]

        stages.insert_one(option_dict)

        return make_response(
            False,
            "Stage inserted successfully",
            result=option_complete.model_dump(exclude_none=True),
            status=200
        )
    except Exception as e:
        return make_response(True, f"Error inserting Stage: {str(e)}", status=500)

@villageStages_BP.route("/stages/<stageId>", methods=["PUT"])
def update_Stage(stageId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        # Stages should not be updated here
        if "stages" in payload:
            return make_response(True, "Updating stages is not allowed here", status=400)

        try:
            update_obj = StageUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)
        total_stages = stages.count_documents({"deleted": False})

        stage = stages.find_one({"stageId": str(stageId), "deleted": False})
        if not stage:
            return make_response(True, "Stage not found", status=404)
        old_pos = stage["position"]
        new_pos = update_obj.position if update_obj.position is not None else old_pos

        if new_pos < 0 or new_pos > total_stages:
            return make_response(True, f"Position must be between 0 and {total_stages-1}", status=400)

        # Only update provided fields
        update_dict = update_obj.model_dump(
            exclude_unset=True,
            exclude_none=True,
            exclude={"stages"}
        )

        if not update_dict:
            return make_response(True, "No valid fields to update", status=400)
        if new_pos > old_pos:
            stages.update_many(
                {"deleted": False, "position": {"$gt": old_pos, "$lte": new_pos}},
                {"$inc": {"position": -1}}
            )
        elif new_pos < old_pos:
            stages.update_many(
                {"deleted": False, "position": {"$gte": new_pos, "$lt": old_pos}},
                {"$inc": {"position": 1}}
            )
        stages.update_one({"stageId": str(stageId)}, {"$set": update_dict})

        return make_response(False, "Stage updated successfully", result=update_dict)

    except Exception as e:
        return make_response(True, f"Error updating option: {str(e)}", status=500)


@villageStages_BP.route("/stages/<stageId>", methods=["DELETE"])
def delete_Stage(stageId):
    try:
        stage = stages.find_one({"stageId": (stageId), "deleted": False})
        if not stage:
            return make_response(True, "Stage not found", status=404)

        pos = stage.get("position")

        # Mark as deleted
        stages.update_one(
            {"stageId": (stageId)},
            {"$set": {"deleted": True}}
        )

        # Shift positions of later stages up by 1
        stages.update_many(
            {"deleted": False, "position": {"$gt": pos}},
            {"$inc": {"position": -1}}
        )

        return make_response(False, "Stage deleted successfully")

    except Exception as e:
        return make_response(True, f"Error deleting stage: {str(e)}", status=500)


@villageStages_BP.route("/stages", methods=["GET"])
def get_Stages():
    try:
        docs = list(stages.find({"deleted": False}, {"_id": 0}).sort("position", 1))
        if not docs:
            return make_response(True, "No Stages found",result={"count": 0, "items": []}, status=404)

        return make_response(False, "Stages fetched successfully", result={"count": len(docs), "items": docs}, status=200)

    except Exception as e:
        return make_response(True, f"Error fetching stages: {str(e)}",result={"count": 0, "items": []}, status=500)


@villageStages_BP.route("/deleted_stages", methods=["GET"])
def get_deleted_stages():
    try:
        docs = list(stages.find({"deleted": True}, {"_id": 0}).sort("position", 1))
        if not docs:
            return make_response(True, "No deleted stages found",result={"count": 0, "items": []}, status=404)

        return make_response(False, "Deleted stages fetched successfully", result={"count": len(docs), "items": docs}, status=200)

    except Exception as e:
        return make_response(True, f"Error fetching deleted stages: {str(e)}",result={"count": 0, "items": []}, status=500)
    

@villageStages_BP.route("/deleted_substages/<stageId>", methods=["GET"])
def get_deleted_substages(stageId):
    try:
        option = stages.find_one(
            {"stageId": stageId, "deleted": False},
            {"_id": 0}
        )
        if not option:
            return make_response(True, "Stage not found", result={"count": 0, "items": []},status=404)

        deleted_stages = [s for s in option.get("stages", []) if s.get("deleted", False)]

        if not deleted_stages:
            return make_response(True, "No deleted sub stages found",result={"count": 0, "items": []}, status=404)

        return make_response(
            False,
            "Deleted sub stages fetched successfully",
            result={"count": len(deleted_stages), "items": deleted_stages},
            status=200
        )
    except Exception as e:
        return make_response(True, f"Error fetching deleted sub stages: {str(e)}", result={"count": 0, "items": []},status=500)


@villageStages_BP.route("/substage/insert/<stageId>", methods=["POST"])
def insert_substage(stageId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        try:
            stage_obj = SubStageInsert(**payload)
        except ValidationError as ve:
            return make_response(True, "Validation error", result=ve.errors(), status=400)

        option = stages.find_one({"stageId": stageId, "deleted": False})
        #substages = option.get("stages", [])
        if not option:
            return make_response(True, "stage not found", status=404)

        # Generate stageId
        new_stage_id = get_next_villageSubStage_id(db, stageId)
        stage_complete = {
            **stage_obj.model_dump(exclude_none=True, exclude={"position"}),
            "subStageId": new_stage_id
        }

        stages_ = option.get("stages", [])

        # Insert at position or append
        pos = getattr(stage_obj, "position", None)
        pos = pos if pos is not None else len(stages_)
        if pos < 0 or pos > len(stages_):
            return make_response(True, f"Position must be between 0 and {len(stages_)}", status=400)

        stages_.insert(pos, stage_complete)

        stages.update_one(
            {"stageId": stageId},
            {"$set": {"stages": stages_}}
        )

        return make_response(False, "Sub stage inserted successfully", result=stage_complete)
    except Exception as e:
        return make_response(True, f"Error inserting sub stage: {str(e)}", status=500)

@villageStages_BP.route("/sstages/<stageId>/<subStageId>", methods=["PUT"])
def update_substage(stageId, subStageId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        try:
            stage_obj = SubStageUpdate(**payload)
        except ValidationError as ve:
            return make_response(True, "Validation error", result=ve.errors(), status=400)

        option = stages.find_one({"stageId": stageId, "deleted": False})
        if not option:
            return make_response(True, "stage not found", status=404)

        stages_ = option.get("stages", [])
        stage = next((s for s in stages_ if s["subStageId"] == subStageId), None)
        if not stage:
            return make_response(True, "Sub Stage not found", status=404)
        if stage.get("deleted", False):
            return make_response(True, "Cannot update deleted sub stage", status=400)

        update_dict = stage_obj.model_dump(exclude_none=True, exclude={"position"})
        if not update_dict and "position" not in payload:
            return make_response(True, "No valid fields to update", status=400)

        # --- Step 1: Update fields normally ---
        stages.update_one(
            {"stageId": stageId, "stages.subStageId": subStageId},
            {"$set": {f"stages.$.{k}": v for k, v in update_dict.items()}}
        )

        # --- Step 2: Handle position rearrangement ---
        if "position" in payload:
            new_pos = payload["position"]
            if not isinstance(new_pos, int):
                return make_response(True, "Position must be an integer", status=400)
            if new_pos < 0 or new_pos >= len(stages_):
                return make_response(True, f"Position must be between 0 and {len(stages_)-1}", status=400)

            # Remove current substage
            stages_ = [s for s in stages_ if s["subStageId"] != subStageId]

            # Re-insert at new position
            stage.update(update_dict)  # ensure latest fields are merged
            stages_.insert(new_pos, stage)

            stages.update_one(
                {"stageId": stageId},
                {"$set": {"stages": stages_}}
            )

        return make_response(False, "Sub stage updated successfully", result={**update_dict, **({"position": payload.get("position")} if "position" in payload else {})})

    except Exception as e:
        return make_response(True, f"Error updating sub stage: {str(e)}", status=500)

@villageStages_BP.route("/sstages/<stageId>/<subStageId>", methods=["DELETE"])
def delete_sub_stage(stageId, subStageId):
    try:
        result = stages.update_one(
            {"stageId": stageId, "stages.subStageId": subStageId},
            {"$set": {"stages.$.deleted": True}}
        )
        if result.matched_count == 0:
            return make_response(True, "Stage not found", status=404)

        return make_response(False, "sub stage deleted successfully")
    except Exception as e:
        return make_response(True, f"Error deleting sub stage: {str(e)}", status=500)



@villageStages_BP.route("/village_updates/insert/<villageId>", methods=["POST"])
def insert_village_update(villageId):
    try:
        payload = request.get_json(force=True)
        data = VillageUpdatesInsert(**payload)

        # -------- Fetch village --------
        village = villages.find_one({"villageId": villageId}, {"_id": 0})
        if not village:
            return make_response(True, f"Village {villageId} not found", status=404)

        # -------- Validate Stage --------
        stage_doc = stages.find_one({"stageId": data.currentStage,"deleted":False}, {"_id": 0})
        if not stage_doc:
            return make_response(True, f"Stage {data.currentStage} not found", status=400)

        # -------- Extract subStageIds for current stage --------
        sub_stage_ids = [s.get("subStageId") for s in stage_doc.get("stages", []) if not s.get("deleted", False)]

        if data.currentSubStage not in sub_stage_ids:
            return make_response(
                True,
                f"SubStage {data.currentSubStage} not found in Stage {data.currentStage}",
                status=400
            )

        # -------- Flatten All SubStages across all stages --------
        all_stages = list(stages.find({"deleted":False}, {"_id": 0, "stageId": 1, "stages.subStageId": 1, "stages.deleted": 1}))
        flattened = [
            sub.get("subStageId")
            for st in all_stages
            for sub in st.get("stages", [])
            if not sub.get("deleted", False)
        ]

        if data.currentSubStage not in flattened:
            return make_response(True, f"Invalid SubStage {data.currentSubStage}", status=400)

        # -------- Pre-requisite check --------
        idx = flattened.index(data.currentSubStage)
        prereqs = flattened[:idx]

        completed = set(village.get("completed_substages", []))
        missing = [p for p in prereqs if p not in completed]
        if missing:
            return make_response(True, f"Missing prerequisite SubStages: {missing}", status=400)

        # -------- Create Update Record --------
        new_update_id = get_next_villageStageUpdate_id(db, villageId=villageId)
        update_obj = VillageUpdates(
            **data.dict(),
            updateId=new_update_id,
            verifiedBy="system",   # later replace with auth user
            verifiedAt=datetime.utcnow().isoformat()
        ).dict()

        # -------- Update Village --------
        villages.update_one(
            {"villageId": villageId},
            {
                "$set": {
                    "currentStage": data.currentStage,
                    "currentSubStage": data.currentSubStage,
                },
                "$addToSet": {"completed_substages": data.currentSubStage},
                "$push": {"updates": update_obj},
            },
        )

        return make_response(False, "Village update inserted successfully", status=201)

    except ValidationError as ve:
        return make_response(True, ve.errors(), status=400)
    except Exception as e:
        return make_response(True, str(e), status=500)

@villageStages_BP.route("/village_updates/<villageId>/<updateId>", methods=["PUT"])
def update_village_update(villageId, updateId):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing request body or userId", status=400)

        try:
            update_obj = VillageUpdatesUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # # Stage/subStage cannot be changed
        # if update_obj.currentStage or update_obj.currentSubStage:
        #     return make_response(True, "Updating stage/subStage not allowed", status=400)

        # Fetch village and target update
        village = villages.find_one({"villageId": villageId})
        if not village:
            return make_response(True, "Village not found", status=404)

        update_item = next((u for u in village.get("updates", []) if u["updateId"] == updateId), None)
        if not update_item:
            return make_response(True, "Update not found", status=404)
        if update_item.get("deleted", False):
            return make_response(True, "Cannot update deleted update", status=400)

        # Build update dict
        now = datetime.utcnow().isoformat()
        update_dict = update_obj.model_dump(exclude_none=True)
        update_dict.update({"verifiedAt": now, "verifiedBy": userId})

        villages.update_one(
            {"villageId": villageId, "updates.updateId": updateId},
            {"$set": {f"updates.$.{k}": v for k, v in update_dict.items()}},
        )

        return make_response(False, "Village update modified successfully", result=update_dict)
    except Exception as e:
        return make_response(True, f"Error updating village update: {str(e)}", status=500)


@villageStages_BP.route("/village_updates/<villageId>/<updateId>", methods=["DELETE"])
def delete_village_update(villageId, updateId):
    try:
        payload = request.get_json(force=True)
        userId = payload.get("userId") if payload else None

        if not userId:
            return make_response(True, "Missing userId in request body", status=400)

        village = villages.find_one({"villageId": villageId})
        if not village:
            return make_response(True, "Village not found", status=404)

        update_item = next(
            (u for u in village.get("updates", []) if u["updateId"] == updateId and not u.get("deleted", False)),
            None
        )
        if not update_item:
            return make_response(True, "Update not found", status=404)

        # Check if this is the only non-deleted update for that stage/substage
        stage = update_item["currentStage"]
        substage = update_item["currentSubStage"]

        non_deleted_count = sum(
            1 for u in village.get("updates", [])
            if u.get("currentStage") == stage and u.get("currentSubStage") == substage and not u.get("deleted", False)
        )

        update_ops = {"$set": {"updates.$.deleted": True}}

        if non_deleted_count == 1:
            # Remove substage from completed_substages
            update_ops["$pull"] = {"completed_substages": substage}

        # Apply deletion update
        villages.update_one(
            {"villageId": villageId, "updates.updateId": updateId},
            update_ops
        )

        # Now recalculate currentStage/currentSubStage
        remaining_updates = [
            u for u in village.get("updates", []) if not u.get("deleted", False) and u["updateId"] != updateId
        ]

        if remaining_updates:
            # Take latest by verifiedAt (or fall back to order)
            latest_update = sorted(
                remaining_updates, key=lambda x: x.get("verifiedAt", ""), reverse=True
            )[0]
            villages.update_one(
                {"villageId": villageId},
                {"$set": {
                    "currentStage": latest_update["currentStage"],
                    "currentSubStage": latest_update["currentSubStage"]
                }}
            )
        else:
            # Reset stage/substage if no updates left
            villages.update_one(
                {"villageId": villageId},
                {"$set": {"currentStage": None, "currentSubStage": None}}
            )

        return make_response(False, "Village update deleted successfully")

    except Exception as e:
        return make_response(True, f"Error deleting village update: {str(e)}", status=500)



@villageStages_BP.route("/village_updates/<villageId>", methods=["GET"])
def get_village_updates(villageId):
    try:
        # --------- Fetch Village ---------
        village = villages.find_one({"villageId": villageId}, {"_id": 0})
        if not village:
            return make_response(True, "Village not found",result={"count": 0, "items": []}, status=404)

        # --------- Filter by Deleted Flag ---------
        flag = request.args.get("deleted", "false").lower()  # default = false
        if flag not in ["true", "false"]:
            return make_response(True, "Invalid 'deleted' flag. Use true or false.",result={"count": 0, "items": []}, status=400)

        deleted = flag == "true"
        updates = [u for u in village.get("updates", []) if u.get("deleted", False) == deleted]

        if not updates:
            return make_response(True, "No updates found", result={"count": 0, "items": []},status=404)

        return make_response(
            False,
            "Village updates fetched successfully",
            result={"count": len(updates), "items": updates},
        )

    except Exception as e:
        return make_response(True, f"Error fetching village updates: {str(e)}",result={"count": 0, "items": []}, status=500)
