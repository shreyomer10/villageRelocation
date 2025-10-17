from flask import Blueprint, request
from pydantic import ValidationError
from utils.helpers import make_response, validation_error_response
from config import db
from models.constructionMaterial import MaterialInsert, MaterialUpdate, Material  # your Pydantic models
from models.counters import get_next_material_id

materials_bp = Blueprint("materials", __name__)
materials = db.materials


# ================= CREATE MATERIAL =================
@materials_bp.route("/materials", methods=["POST"])
def insert_material():
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        # Validate
        try:
            material_obj = MaterialInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # Generate materialId
        new_material_id = get_next_material_id(db)

        material_complete = Material(
            materialId=new_material_id,
            **material_obj.model_dump(exclude_none=True)
        )

        materials.insert_one(material_complete.model_dump(exclude_none=True))

        return make_response(False, "Material inserted successfully", result=material_complete.model_dump(exclude_none=True), status=200)
    except Exception as e:
        return make_response(True, f"Error inserting material: {str(e)}", status=500)


# ================= UPDATE MATERIAL =================
@materials_bp.route("/materials/<materialId>", methods=["PUT"])
def update_material(materialId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        try:
            update_obj = MaterialUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        update_dict = update_obj.model_dump(exclude_none=True)
        if not update_dict:
            return make_response(True, "No valid fields to update", status=400)

        material = materials.find_one({"materialId": str(materialId)})
        if not material:
            return make_response(True, "Material not found", status=404)

        materials.update_one({"materialId": str(materialId)}, {"$set": update_dict})

        return make_response(False, "Material updated successfully", result=update_dict)
    except Exception as e:
        return make_response(True, f"Error updating material: {str(e)}", status=500)


# ================= DELETE MATERIAL =================
@materials_bp.route("/materials/<materialId>", methods=["DELETE"])
def delete_material(materialId):
    try:
        material = materials.find_one({"materialId": str(materialId)})
        if not material:
            return make_response(True, "Material not found", status=404)

        # Hard delete
        materials.delete_one({"materialId": str(materialId)})

        return make_response(False, "Material deleted successfully")
    except Exception as e:
        return make_response(True, f"Error deleting material: {str(e)}", status=500)


# ================= GET MATERIALS =================
@materials_bp.route("/materials", methods=["GET"])
def get_materials():
    try:
        docs = list(materials.find({}, {"_id": 0}))

        if not docs:
            return make_response(True, "No materials found", result={"count": 0, "items": []}, status=404)

        return make_response(False, "Materials fetched successfully", result={"count": len(docs), "items": docs}, status=200)
    except Exception as e:
        return make_response(True, f"Error fetching materials: {str(e)}", status=500)
