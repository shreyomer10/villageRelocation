
import datetime as dt
import logging

from flask import Blueprint, logging,request, jsonify
from pydantic import ValidationError
from models.stages import Building, BuildingInsert, BuildingStages, BuildingStagesInsert, BuildingStagesUpdate, BuildingUpdate
from models.counters import get_next_building_type_id, get_next_stage_id
from utils.helpers import make_response
from config import  db

from pymongo import errors  
buildings = db.buildings
villages = db.villages

building_bp = Blueprint("buildings",__name__)


@building_bp.route("/buildings/insert", methods=["POST"])
def insert_building():
    try:
        payload = request.get_json(force=True)

        if not payload:
            return make_response(True, "Missing request body", status=400)

        # ✅ Validate input against insert model
        try:
            building_obj = BuildingInsert(**payload)
        except ValidationError as ve:
            return make_response(True, "Validation error", result=ve.errors(), status=400)

        # ✅ Ensure villageId is present
        villageId = payload.get("villageId")
        if not villageId:
            return make_response(True, "villageId is required", status=400)

        # 🔍 Check if villageId exists in villages collection
        village_exists = villages.find_one({"villageId": villageId})
        if not village_exists:
            return make_response(True, f"Village with ID {villageId} does not exist", status=404)

        # ✅ Generate building typeId
        new_type_id = get_next_building_type_id(db, villageId)

        # ✅ Generate stageIds and validate with BuildingStages model
        stages_with_id = []
        for stage in building_obj.stages:
            stage_id = get_next_stage_id(db, new_type_id)
            stage_full = BuildingStages(
                stageId=stage_id,
                **stage.model_dump(exclude_none=True)
            )
            stages_with_id.append(stage_full)

        # ✅ Build Building object with IDs
        building_complete = Building(
            typeId=new_type_id,
            name=building_obj.name,
            villageId=building_obj.villageId,
            stages=stages_with_id,
            deleted=building_obj.deleted
        )

        # ✅ Properly dump nested models
        building_dict = building_complete.model_dump(exclude_none=True)
        building_dict["stages"] = [s.model_dump(exclude_none=True) for s in stages_with_id]

        buildings.insert_one(building_dict)

        return make_response(
            False,
            "Building inserted successfully",
            result=building_complete.model_dump(exclude_none=True),
            status=200
        )
    except Exception as e:
        return make_response(True, f"Error inserting building: {str(e)}", status=500)

@building_bp.route("/buildings/<buildingId>/<villageId>", methods=["PUT"])
def update_building(buildingId, villageId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)
        if "stages" in payload:
            return make_response(True, "Updating stages is not allowed here", status=400)

        try:
            update_obj = BuildingUpdate(**payload)
        except ValidationError as ve:
            return make_response(True, "Validation error", result=ve.errors(), status=400)

        building = buildings.find_one({"typeId": buildingId, "villageId": villageId})
        if not building:
            return make_response(True, "Building not found", status=404)
        if building.get("deleted", False):
            return make_response(True, "Cannot update deleted building", status=400)

        update_dict = update_obj.model_dump(exclude_none=True, exclude={"stages"})
        if not update_dict:
            return make_response(True, "No valid fields to update", status=400)

        buildings.update_one({"typeId": buildingId}, {"$set": update_dict})
        return make_response(False, "Building updated successfully", result=update_dict)
    except Exception as e:
        return make_response(True, f"Error updating building: {str(e)}", status=500)
    
@building_bp.route("/buildings/<buildingId>/<villageId>", methods=["DELETE"])
def delete_building(buildingId, villageId):
    try:
        result = buildings.update_one(
            {"typeId": buildingId, "villageId": villageId},
            {"$set": {"deleted": True}}
        )
        if result.matched_count == 0:
            return make_response(True, "Building not found", status=404)

        return make_response(False, "Building deleted successfully")
    except Exception as e:
        return make_response(True, f"Error deleting building: {str(e)}", status=500)

@building_bp.route("/buildings/<villageId>", methods=["GET"])
def get_buildings(villageId):
    try:
        docs = list(buildings.find(
            {"villageId": villageId, "deleted": False},
            {"_id": 0}
        ))

        if not docs:
            return make_response(True, "No buildings found", status=404)

        for doc in docs:
            doc["stages"] = [s for s in doc.get("stages", []) if not s.get("deleted", False)]

        return make_response(
            False,
            "Buildings fetched successfully",
            result={"count": len(docs), "items": docs},
            status=200
        )
    except Exception as e:
        return make_response(True, f"Error fetching buildings: {str(e)}", status=500)

@building_bp.route("/deleted_bstages/<buildingId>/<villageId>", methods=["GET"])
def get_deleted_stages(buildingId, villageId):
    try:
        building = buildings.find_one(
            {"typeId": buildingId, "villageId": villageId,"deleted":False},
            {"_id": 0}
        )
        if not building:
            return make_response(True, "Building not found", status=404)

        deleted_stages = [s for s in building.get("stages", []) if s.get("deleted", False)]

        if not deleted_stages:
            return make_response(True, "No deleted stages found", status=404)

        return make_response(
            False,
            "Deleted stages fetched successfully",
            result={"count": len(deleted_stages), "items": deleted_stages},
            status=200
        )
    except Exception as e:
        return make_response(True, f"Error fetching deleted stages: {str(e)}", status=500)

@building_bp.route("/deleted_buildings/<villageId>", methods=["GET"])
def get_deleted_buildings(villageId):
    try:
        docs = list(buildings.find(
            {"villageId": villageId, "deleted": True},
            {"_id": 0}
        ))

        if not docs:
            return make_response(True, "No deleted buildings found", status=404)

        return make_response(
            False,
            "Deleted buildings fetched successfully",
            result={"count": len(docs), "items": docs},
            status=200
        )
    except Exception as e:
        return make_response(True, f"Error fetching deleted buildings: {str(e)}", status=500)

@building_bp.route("/bstages/insert/<buildingId>/<villageId>", methods=["POST"])
def insert_stage(buildingId, villageId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        try:
            stage_obj = BuildingStagesInsert(**payload)
        except ValidationError as ve:
            return make_response(True, "Validation error", result=ve.errors(), status=400)

        building = buildings.find_one(
            {"typeId": buildingId, "villageId": villageId, "deleted": False}
        )
        if not building:
            return make_response(True, "Building not found", status=404)

        # Generate stageId
        new_stage_id = get_next_stage_id(db, building["typeId"])
        stage_complete = {
            **stage_obj.model_dump(exclude_none=True, exclude={"position"}),
            "stageId": new_stage_id
        }

        stages = building.get("stages", [])

        # Determine insert position
        pos = stage_obj.position if stage_obj.position is not None else len(stages)
        if pos < 0 or pos > len(stages):
            return make_response(True, f"Position must be between 0 and {len(stages)}", status=400)

        # Insert at position
        stages.insert(pos, stage_complete)

        # Update the building with reordered stages
        buildings.update_one(
            {"typeId": buildingId, "villageId": villageId},
            {"$set": {"stages": stages}}
        )

        return make_response(False, "Stage inserted successfully", result=stage_complete)
    except Exception as e:
        return make_response(True, f"Error inserting stage: {str(e)}", status=500)


@building_bp.route("/bstages/<buildingId>/<villageId>/<stageId>", methods=["PUT"])
def update_stage(buildingId, villageId, stageId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        try:
            stage_obj = BuildingStagesUpdate(**payload)
        except ValidationError as ve:
            return make_response(True, "Validation error", result=ve.errors(), status=400)

        building = buildings.find_one({"typeId": buildingId, "villageId": villageId,"deleted":False})
        if not building:
            return make_response(True, "Building not found", status=404)
        if building.get("deleted", False):
            return make_response(True, "Cannot update stage of deleted building", status=400)

        stage = next((s for s in building.get("stages", []) if s["stageId"] == stageId), None)
        if not stage:
            return make_response(True, "Stage not found", status=404)
        if stage.get("deleted", False):
            return make_response(True, "Cannot update deleted stage", status=400)

        update_dict = stage_obj.model_dump(exclude_none=True)
        if not update_dict:
            return make_response(True, "No valid fields to update", status=400)

        buildings.update_one(
            {"typeId": buildingId, "stages.stageId": stageId},
            {"$set": {f"stages.$.{k}": v for k, v in update_dict.items()}}
        )
        return make_response(False, "Stage updated successfully", result=update_dict)
    except Exception as e:
        return make_response(True, f"Error updating stage: {str(e)}", status=500)

@building_bp.route("/bstages/<buildingId>/<villageId>/<stageId>", methods=["DELETE"])
def delete_stage(buildingId, villageId, stageId):
    try:
        result = buildings.update_one(
            {"typeId": buildingId, "villageId": villageId, "stages.stageId": stageId},
            {"$set": {"stages.$.deleted": True}}
        )
        if result.matched_count == 0:
            return make_response(True, "Stage not found", status=404)

        return make_response(False, "Stage deleted successfully")
    except Exception as e:
        return make_response(True, f"Error deleting stage: {str(e)}", status=500)