from flask import Blueprint, request
from pydantic import ValidationError
from utils.helpers import make_response, validation_error_response
from config import db
from models.constructionMaterial import MaterialInsert, MaterialUpdate, Material  # your Pydantic models
from models.counters import get_next_material_id

facilities_bp = Blueprint("facilities", __name__)
facilities = db.facilities


# # ================= CREATE MATERIAL =================
# @facilities_bp.route("/facilities", methods=["POST"])
# def insert_facility():
#     try:
#         payload = request.get_json(force=True)
#         if not payload:
#             return make_response(True, "Missing request body", status=400)

#         # Validate
#         try:
#             material_obj = MaterialInsert(**payload)
#         except ValidationError as ve:
#             return validation_error_response(ve)

#         # Generate materialId
#         new_material_id = get_next_material_id(db)

#         material_complete = Material(
#             materialId=new_material_id,
#             **material_obj.model_dump(exclude_none=True)
#         )

#         materials.insert_one(material_complete.model_dump(exclude_none=True))

#         return make_response(False, "Material inserted successfully", result=material_complete.model_dump(exclude_none=True), status=200)
#     except Exception as e:
#         return make_response(True, f"Error inserting material: {str(e)}", status=500)


# # ================= UPDATE MATERIAL =================
# @facilities_bp.route("/facilities/<facilityId>", methods=["PUT"])
# def update_facility(materialId):
#     try:
#         payload = request.get_json(force=True)
#         if not payload:
#             return make_response(True, "Missing request body", status=400)

#         try:
#             update_obj = MaterialUpdate(**payload)
#         except ValidationError as ve:
#             return validation_error_response(ve)

#         update_dict = update_obj.model_dump(exclude_none=True)
#         if not update_dict:
#             return make_response(True, "No valid fields to update", status=400)

#         material = materials.find_one({"materialId": str(materialId)})
#         if not material:
#             return make_response(True, "Material not found", status=404)

#         materials.update_one({"materialId": str(materialId)}, {"$set": update_dict})

#         return make_response(False, "Material updated successfully", result=update_dict)
#     except Exception as e:
#         return make_response(True, f"Error updating material: {str(e)}", status=500)


# # ================= DELETE MATERIAL =================
# @facilities_bp.route("/facilities/<facilityId>", methods=["DELETE"])
# def delete_facility(materialId):
#     try:
#         material = materials.find_one({"materialId": str(materialId)})
#         if not material:
#             return make_response(True, "Material not found", status=404)

#         # Hard delete
#         materials.delete_one({"materialId": str(materialId)})

#         return make_response(False, "Material deleted successfully")
#     except Exception as e:
#         return make_response(True, f"Error deleting material: {str(e)}", status=500)


# # ================= GET MATERIALS =================
# @facilities_bp.route("/facilities", methods=["GET"])
# def get_facility():
#     try:
#         docs = list(materials.find({}, {"_id": 0}))

#         if not docs:
#             return make_response(True, "No materials found", result={"count": 0, "items": []}, status=404)

#         return make_response(False, "Materials fetched successfully", result={"count": len(docs), "items": docs}, status=200)
#     except Exception as e:
#         return make_response(True, f"Error fetching materials: {str(e)}", status=500)
