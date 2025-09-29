
import datetime as dt
import logging

from flask import Blueprint, logging,request, jsonify
from pydantic import ValidationError
from models.stages import OprionStageInsert,OprionStage,OprionStageUpdate,OptionInsert,OptionUpdate, Options
from models.counters import get_next_option_id, get_next_option_stage_id, get_next_plot_id, get_next_verification_id
from utils.helpers import make_response, validation_error_response
from config import  db

from pymongo import errors  
buildings = db.buildings
villages = db.villages
plots = db.plots
families = db.testing
options = db.options

options_BP = Blueprint("options",__name__)

from datetime import datetime
from pymongo import ReturnDocument


@options_BP.route("/options/insert", methods=["POST"])
def insert_option():
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        # Validate input
        try:
            option_obj = OptionInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)
        total_options = options.count_documents({"deleted": False})
       # pos = option_obj.position if option_obj.position is not None else total_options

        # if pos < 0 or pos > total_options:
        #     return make_response(True, f"Position must be between 0 and {total_options}", status=400)

        # Generate new optionId (sequence or custom logic)
        new_option_id = get_next_option_id(db)


        # ✅ Generate stageIds and validate with BuildingStages model
        stages_with_id = []
        for stage in option_obj.stages:
            stage_id = get_next_option_stage_id(db, new_option_id)
            stage_full = OprionStage(
                stageId=stage_id,
                **stage.model_dump(exclude_none=True)
            )
            stages_with_id.append(stage_full)

        # ✅ Build Building object with IDs
        option_complete = Options(
            optionId=new_option_id,
            name=option_obj.name,
            desc=option_obj.desc,
            stages=stages_with_id,
            deleted=False,
            #position=pos

        )
        # options.update_many(
        #     {"deleted": False, "position": {"$gte": pos}},
        #     {"$inc": {"position": 1}}
        # )
        # ✅ Properly dump nested models
        option_dict = option_complete.model_dump(exclude_none=True)
        option_dict["stages"] = [s.model_dump(exclude_none=True) for s in stages_with_id]

        options.insert_one(option_dict)

        return make_response(
            False,
            "Option inserted successfully",
            result=option_complete.model_dump(exclude_none=True),
            status=200
        )
    except Exception as e:
        return make_response(True, f"Error inserting building: {str(e)}", status=500)

# ========== UPDATE OPTION ==========
@options_BP.route("/options/<optionId>", methods=["PUT"])
def update_option(optionId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        # Stages should not be updated here
        if "stages" in payload:
            return make_response(True, "Updating stages is not allowed here", status=400)

        try:
            update_obj = OptionUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)
        total_options = options.count_documents({"deleted": False})

        option = options.find_one({"optionId": str(optionId), "deleted": False})
        if not option:
            return make_response(True, "Option not found", status=404)
        # old_pos = option["position"]
        # new_pos = update_obj.position if update_obj.position is not None else old_pos
        # if new_pos < 0 or new_pos > total_options:
        #     return make_response(True, f"Position must be between 0 and {total_options-1}", status=400)

        # Only update provided fields
        update_dict = update_obj.model_dump(
            exclude_unset=True,
            exclude_none=True,
            exclude={"stages"}
        )

        if not update_dict:
            return make_response(True, "No valid fields to update", status=400)
        # if new_pos > old_pos:
        #     options.update_many(
        #         {"deleted": False, "position": {"$gt": old_pos, "$lte": new_pos}},
        #         {"$inc": {"position": -1}}
        #     )
        # elif new_pos < old_pos:
        #     options.update_many(
        #         {"deleted": False, "position": {"$gte": new_pos, "$lt": old_pos}},
        #         {"$inc": {"position": 1}}
        #     )
        options.update_one({"optionId": str(optionId)}, {"$set": update_dict})

        return make_response(False, "Option updated successfully", result=update_dict)

    except Exception as e:
        return make_response(True, f"Error updating option: {str(e)}", status=500)


# ========== DELETE OPTION ==========
@options_BP.route("/options/<optionId>", methods=["DELETE"])
def delete_option(optionId):
    try:
        option = options.find_one({"optionId": str(optionId)})
        if not option:
            return make_response(True, "Option not found", status=404)

        # status_history = option.get("statusHistory", [])
        # status_history.append({
        #     "status": "DELETED",
        #     "time": datetime.utcnow().isoformat()
        # })
        pos = option.get("position")

        options.update_one(
            {"optionId": str(optionId)},
            {"$set": {"deleted": True}}
        )
        # options.update_many(
        #     {"deleted": False, "position": {"$gt": pos}},
        #     {"$inc": {"position": -1}}
        # )
        return make_response(False, "Option deleted successfully")

    except Exception as e:
        return make_response(True, f"Error deleting option: {str(e)}", status=500)


# ========== GET OPTIONS ==========
@options_BP.route("/options", methods=["GET"])
def get_options():
    try:
        docs = list(options.find({"deleted": False}, {"_id": 0}))

        if not docs:
            return make_response(True, "No options found", status=404)

        return make_response(False, "Options fetched successfully", result={"count": len(docs), "items": docs}, status=200)

    except Exception as e:
        return make_response(True, f"Error fetching options: {str(e)}", status=500)


# ========== GET DELETED OPTIONS ==========
@options_BP.route("/deleted_options", methods=["GET"])
def get_deleted_options():
    try:
        docs = list(options.find({"deleted": True}, {"_id": 0}).sort("position", 1))
        if not docs:
            return make_response(True, "No deleted options found", status=404)

        return make_response(False, "Deleted options fetched successfully", result={"count": len(docs), "items": docs}, status=200)

    except Exception as e:
        return make_response(True, f"Error fetching deleted options: {str(e)}", status=500)
    


@options_BP.route("/deleted_ostages/<optionId>", methods=["GET"])
def get_deleted_option_stages(optionId):
    try:
        option = options.find_one(
            {"optionId": optionId, "deleted": False},
            {"_id": 0}
        )
        if not option:
            return make_response(True, "Option not found", status=404)

        deleted_stages = [s for s in option.get("stages", []) if s.get("deleted", False)]

        if not deleted_stages:
            return make_response(True, "No deleted option stages found", status=404)

        return make_response(
            False,
            "Deleted option stages fetched successfully",
            result={"count": len(deleted_stages), "items": deleted_stages},
            status=200
        )
    except Exception as e:
        return make_response(True, f"Error fetching deleted option stages: {str(e)}", status=500)


@options_BP.route("/ostages/insert/<optionId>", methods=["POST"])
def insert_option_stage(optionId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        try:
            stage_obj = OprionStageInsert(**payload)
        except ValidationError as ve:
            return make_response(True, "Validation error", result=ve.errors(), status=400)

        option = options.find_one({"optionId": optionId, "deleted": False})
        if not option:
            return make_response(True, "Option not found", status=404)

        # Generate stageId
        new_stage_id = get_next_option_stage_id(db, optionId)
        stage_complete = {
            **stage_obj.model_dump(exclude_none=True, exclude={"position"}),
            "stageId": new_stage_id
        }

        stages = option.get("stages", [])

        # Insert at position or append
        pos = getattr(stage_obj, "position", None)
        pos = pos if pos is not None else len(stages)
        if pos < 0 or pos > len(stages):
            return make_response(True, f"Position must be between 0 and {len(stages)}", status=400)

        stages.insert(pos, stage_complete)

        options.update_one(
            {"optionId": optionId},
            {"$set": {"stages": stages}}
        )

        return make_response(False, "Option stage inserted successfully", result=stage_complete)
    except Exception as e:
        return make_response(True, f"Error inserting option stage: {str(e)}", status=500)


@options_BP.route("/ostages/<optionId>/<stageId>", methods=["PUT"])
def update_option_stage(optionId, stageId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        try:
            stage_obj = OprionStageUpdate(**payload)
        except ValidationError as ve:
            return make_response(True, "Validation error", result=ve.errors(), status=400)

        option = options.find_one({"optionId": optionId, "deleted": False})
        if not option:
            return make_response(True, "Option not found", status=404)
        stages_ = option.get("stages", [])

        stage = next((s for s in stages_ if s["stageId"] == stageId), None)
        if not stage:
            return make_response(True, "Stage not found", status=404)
        if stage.get("deleted", False):
            return make_response(True, "Cannot update deleted stage", status=400)

        update_dict = stage_obj.model_dump(exclude_none=True)
        if not update_dict:
            return make_response(True, "No valid fields to update", status=400)

        options.update_one(
            {"optionId": optionId, "stages.stageId": stageId},
            {"$set": {f"stages.$.{k}": v for k, v in update_dict.items()}}
        )
        if "position" in payload:
            new_pos = payload["position"]
            if not isinstance(new_pos, int):
                return make_response(True, "Position must be an integer", status=400)
            if new_pos < 0 or new_pos >= len(stages_):
                return make_response(True, f"Position must be between 0 and {len(stages_)-1}", status=400)

            # Remove current substage
            stages_ = [s for s in stages_ if s["stageId"] != stageId]

            # Re-insert at new position
            stage.update(update_dict)  # ensure latest fields are merged
            stages_.insert(new_pos, stage)

            options.update_one(
                {"optionId": optionId},
                {"$set": {"stages": stages_}}
            )
        return make_response(False, "Option stage updated successfully", result=update_dict)
    except Exception as e:
        return make_response(True, f"Error updating option stage: {str(e)}", status=500)


@options_BP.route("/ostages/<optionId>/<stageId>", methods=["DELETE"])
def delete_option_stage(optionId, stageId):
    try:
        result = options.update_one(
            {"optionId": optionId, "stages.stageId": stageId},
            {"$set": {"stages.$.deleted": True}}
        )
        if result.matched_count == 0:
            return make_response(True, "Stage not found", status=404)

        return make_response(False, "Option stage deleted successfully")
    except Exception as e:
        return make_response(True, f"Error deleting option stage: {str(e)}", status=500)
