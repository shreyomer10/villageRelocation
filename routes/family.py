
import datetime as dt
import logging

from flask import Flask, Blueprint, logging,request, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from models.counters import get_next_family_id, get_next_family_update_id, get_next_member_update_id
from utils.helpers import make_response, validation_error_response
from models.family import Family, FamilyCard, FamilyComplete, FamilyUpdate, Member, StatusHistory, Updates, UpdatesInsert, UpdatesUpdate
from config import JWT_EXPIRE_MIN, db

from pymongo import errors  

users = db.users

villages = db.villages
stages = db.stages

families = db.testing
options = db.options
updates=db.optionUpdates


family_bp = Blueprint("family",__name__)


@family_bp.route("/villages/<village_id>/beneficiaries", methods=["GET"])
def get_beneficiaries(village_id):
    try:
        # -------- Validate Inputs --------
        if not village_id or not isinstance(village_id, str):
            return make_response(True, "Invalid or missing village_id", status=400)

        option_id = request.args.get("optionId")
        name=request.args.get("mukhiyaName")

        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 15))

        # -------- Build Query --------
        q = {"villageId": village_id}
        if option_id:
            q["relocationOption"] = option_id
        if name:
            q["mukhiyaName"] = {"$regex": name, "$options": "i"}
        projection = {
            "_id": 0,
            "familyId": 1,
            "mukhiyaName": 1,
            "mukhiyaPhoto": 1,
            "relocationOption": 1,
        }
        skip = (page - 1) * limit


        cursor = (
            families.find(q, projection)
            .sort("mukhiyaName", ASCENDING)
            .skip(skip)
            .limit(limit)
        )

        # -------- Transform Results --------
        results = list(cursor)  # just return as is

        if not results:
            return make_response(False, "No beneficiaries found for given village and option", result=[], status=200)

        return make_response(False, "Beneficiaries fetched successfully", result=results, status=200)

    except Exception as e:
        logging.error(f"Unexpected error in get_beneficiaries: {str(e)}")
        return make_response(True, f"Internal server error {str(e)}", status=500)


@family_bp.route("/families/<family_id>", methods=["GET"])
def get_family_data(family_id):
    try:
        if not family_id or not isinstance(family_id, str):
            return make_response(True, "Invalid or missing family_id", status=400)

        # Fetch whole doc except Mongo _id
        f = families.find_one({"familyId": family_id}, {"_id": 0})
        if not f:
            return make_response(True, "Family not found",  result=[],status=404)

        # Remove top-level updates

        # # Remove updates inside each member
        # if "members" in f and isinstance(f["members"], list):
        #     for member in f["members"]:
        #         member.pop("updates", None)

        return make_response(False, "Family fetched successfully", result=f, status=200)

    except Exception as e:
        return make_response(True, "Internal server error", status=500)


@family_bp.route("/families/insertbulk", methods=["POST"])
def bulk_insert_families():
    try:
        payload = request.get_json(force=True)

        if not payload or "families" not in payload:
            return make_response(True, "Missing 'families' in request body", status=400)

        families_data = payload["families"]
        if not isinstance(families_data, list):
            return make_response(True, "'families' must be a list", status=400)

        inserted, skipped, errors_list = [], [], []

        for fam in families_data:
            try:
                forbidden_fields = {"updates", "currentStage", "statusHistory","stagesCompleted"}
                if any(f in fam for f in forbidden_fields):
                    errors_list.append({
                        "familyId": fam.get("mukhiyaName"),
                        "error": f"Fields {forbidden_fields} not allowed at insert"
                    })
                    continue

                # ✅ Validate & normalize via Pydantic
                family_obj = Family(**fam)
                members_complete = [
                    Member(
                        **m.model_dump(),
                    )
                    for m in family_obj.members
                ]
                # generate ID
                new_family_id = get_next_family_id(db, family_obj.villageId)

                # combine family data + ID
                fam_complete = FamilyComplete(
                    familyId=new_family_id,
                    currentStage="INIT",
                    stagesCompleted=[],
                    members=members_complete,
                    **family_obj.model_dump(exclude={"members"}, exclude_none=True)
                )
                families.insert_one(fam_complete.model_dump(exclude_none=True))                
                inserted.append(new_family_id)

            except ValidationError as ve:
                error_messages = [str(error) for error in ve.errors()]

                errors_list.append({
                    "familyId": fam.get("mukhiyaName"),
                    "error": error_messages
                })
            except Exception as e:
                error_messages = [str(error) for error in ve.errors()]

                errors_list.append({
                    "familyId": fam.get("mukhiyaName"),
                    "error": error_messages
                })

        summary = {
            "inserted": inserted,
            "skipped_existing": skipped,
            "validation_errors": errors_list
        }

        return make_response(False, "Bulk insert completed", result=summary, status=200)

    except errors.PyMongoError as e:  # ✅ PyMongo error handling
        return make_response(True, f"Database error: {str(e)}", status=500)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)
    
@family_bp.route("/families/insert", methods=["POST"])
def insert_family():
    try:
        payload = request.get_json(force=True)

        if not payload:
            return make_response(True, "Missing request body", status=400)


        forbidden_fields = { "currentStage", "statusHistory","stagesCompleted"}
        if any(f in payload for f in forbidden_fields):
            return make_response(True, f"Fields {forbidden_fields} are not allowed at insert", status=400)

        # ✅ Validate & normalize user input (no familyId expected here)
        try:
            family_obj = Family(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # ✅ Generate familyId automatically based on villageId
        members_complete = [
            Member(
                **m.model_dump(),
            )
            for m in family_obj.members
        ]

        new_family_id = get_next_family_id(db, family_obj.villageId)

        # ✅ Build FamilyComplete object
        fam_complete = FamilyComplete(
            familyId=new_family_id,
            currentStage="INIT",     # 👈 system-managed
            stagesCompleted=[],
            members=members_complete,

            **family_obj.model_dump(exclude={"members"}, exclude_none=True)
        )

        # ✅ Insert into MongoDB
        families.insert_one(fam_complete.model_dump(exclude_none=True))

        return make_response(
            False,
            f"Family {new_family_id} inserted successfully",
            result=fam_complete.model_dump(),
            status=200
        )

    except errors.PyMongoError as e:
        return make_response(True, f"Database error: {str(e)}", status=500)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)

@family_bp.route("/families/deleteall", methods=["DELETE"])
def delete_all_families():
    try:
        result = families.delete_many({})
        return make_response(
            False,
            f"Deleted {result.deleted_count} families",
            status=200
        )
    except errors.PyMongoError as e:
        return make_response(True, f"Database error: {str(e)}", status=500)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)

@family_bp.route("/families/delete/<family_id>", methods=["DELETE"])
def delete_family(family_id):
    try:
        result = families.delete_one({"familyId": family_id})
        if result.deleted_count == 0:
            return make_response(True, f"Family {family_id} not found", status=404)
        return make_response(False, f"Family {family_id} deleted successfully", status=200)
    except errors.PyMongoError as e:
        return make_response(True, f"Database error: {str(e)}", status=500)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)

@family_bp.route("/families/update/<family_id>", methods=["PUT"])
def update_family(family_id):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)
        
        forbidden_fields = {"currentStage", "statusHistory", "familyId","stagesCompleted"}
        if any(f in payload for f in forbidden_fields):
            return make_response(True, f"Fields {forbidden_fields} are not allowed here", status=400)

        # ✅ Validate only provided fields with FamilyUpdate
        try:
            update_obj = FamilyUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # ✅ Convert to dict (exclude None so only sent fields are updated)
        update_dict = update_obj.model_dump(exclude_none=True)

        if not update_dict:
            return make_response(True, "No valid fields to update", status=400)

        # ✅ Update MongoDB
        result = families.update_one(
            {"familyId": family_id},
            {"$set": update_dict}
        )

        if result.matched_count == 0:
            return make_response(True, f"Family {family_id} not found", status=404)

        return make_response(
            False,
            f"Family {family_id} updated successfully",
            result=update_dict,
            status=200
        )

    except errors.PyMongoError as e:
        return make_response(True, f"Database error: {str(e)}", status=500)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)



# #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ FOR FAMILY COMPLAINT AND SUGGESTIONS ~~~~~~~~~~~~~~~~~~~~~~~##

