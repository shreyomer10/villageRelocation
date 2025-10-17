from flask import Blueprint, request
from pydantic import ValidationError
from utils.tokenAuth import auth_required
from models.stages import statusHistory
from config import db
from utils.helpers import authorization, make_response, nowIST, validation_error_response
from models.constructionMaterial import MaterialUpdateInsert, MaterialUpdateUpdate, MaterialUpdates
from models.counters import get_next_material_id, get_next_materialUpdate_id
from datetime import datetime

material_updates_bp = Blueprint("material_updates", __name__)
material_updates = db.materialUpdates
materials = db.materials  # reference to main materials collection


# ================= ADD MATERIAL UPDATE =================
@material_updates_bp.route("/material_update/insert", methods=["POST"])
@auth_required
def insert_material_update(decoded_data):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing request body or userId", status=400)
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        try:
            update_obj = MaterialUpdateInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # Check if material exists
        material = materials.find_one({"materialId": update_obj.materialId})
        if not material:
            return make_response(True, "Material not found", status=404)

        # Generate unique updateId
        update_id = get_next_materialUpdate_id(materialId=update_obj.materialId,db=db)

        now = nowIST()
        history=statusHistory(
            status=1,
            comments="created",
            verifier=userId,
            time=str(now)
        )
        update_doc = MaterialUpdates(
            updateId=update_id,
            type=update_obj.type,
            materialId=update_obj.materialId,
            villageId=update_obj.villageId,
            qty=update_obj.qty,
            unit=update_obj.unit,
            docs=update_obj.docs,
            status=1,
            verifiedAt=str(now),
            verifiedBy=userId,  # or set from user
            insertedBy=userId,
            statusHistory=[history.model_dump()]
        )

        material_updates.insert_one(update_doc.model_dump(exclude_none=True))
        return make_response(False, "Material update inserted successfully", result=update_doc.model_dump(exclude_none=True))

    except Exception as e:
        return make_response(True, f"Error inserting material update: {str(e)}", status=500)


# ================= UPDATE MATERIAL UPDATE =================
@material_updates_bp.route("/material_update/<updateId>", methods=["PUT"])
@auth_required
def update_material_update(decoded_data,updateId):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing request body or userId", status=400)
        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        try:
            update_obj = MaterialUpdateUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        existing = material_updates.find_one({"updateId": updateId})
        if not existing:
            return make_response(True, "Material update not found", status=404)

        update_dict = update_obj.model_dump(exclude_none=True)
        if not update_dict:
            return make_response(True, "No valid fields to update", status=400)
        now = nowIST()

        history=statusHistory(
            status=1,
            comments=update_dict.notes,
            verifier=userId,
            time=str(now)
        )
        material_updates.update_one(
            {"updateId": updateId},
            {"$set": update_dict,
            "$push": {"statusHistory": history.model_dump(exclude_none=True)}})
        return make_response(False, "Material update updated successfully", result=update_dict)

    except Exception as e:
        return make_response(True, f"Error updating material update: {str(e)}", status=500)


# ================= DELETE MATERIAL UPDATE =================
@material_updates_bp.route("/material_update/<updateId>", methods=["DELETE"])
@auth_required
def delete_material_update(decoded_data,updateId):
    try:
        payload = request.get_json(force=True)
        userId = payload.get("userId")

        if not payload or not userId:
            return make_response(True, "Missing request body", status=400)

        error = authorization(decoded_data, userId)
        if error:
            return make_response(True, message=error["message"], status=error["status"])
        existing = material_updates.find_one({"updateId": updateId})
        if not existing:
            return make_response(True, "Material update not found", status=404)

        # Hard delete
        material_updates.delete_one({"updateId": updateId})
        return make_response(False, "Material update deleted successfully")

    except Exception as e:
        return make_response(True, f"Error deleting material update: {str(e)}", status=500)


# ================= GET ALL MATERIAL UPDATES =================
@material_updates_bp.route("/material_update", methods=["GET"])
def get_material_updates():
    try:
        docs = list(material_updates.find({}, {"_id": 0}))
        if not docs:
            return make_response(True, "No material updates found", result={"count": 0, "items": []}, status=404)
        return make_response(False, "Material updates fetched successfully", result={"count": len(docs), "items": docs})
    except Exception as e:
        return make_response(True, f"Error fetching material updates: {str(e)}", status=500)
