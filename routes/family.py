
import datetime as dt
import logging

from flask import Flask, Blueprint, logging,request, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from models.counters import get_next_family_id, get_next_family_update_id, get_next_member_update_id
from utils.helpers import make_response, validation_error_response
from models.family import Family, FamilyCard, FamilyComplete, FamilyUpdate, Member, StatusHistory, Updates, UpdatesInsert
from config import JWT_EXPIRE_MIN, db

from pymongo import errors  

users = db.users

villages = db.villages
stages = db.stages

families = db.testing
options = db.options
family_bp = Blueprint("family",__name__)


@family_bp.route("/villages/<village_id>/beneficiaries", methods=["GET"])
def get_beneficiaries(village_id):
    try:
        # -------- Validate Inputs --------
        if not village_id or not isinstance(village_id, str):
            return make_response(True, "Invalid or missing village_id", status=400)

        option_id = request.args.get("optionId")

        # -------- Build Query --------
        q = {"villageId": village_id}
        if option_id:
            q["relocationOption"] = option_id

        projection = {
            "_id": 0,
            "familyId": 1,
            "mukhiyaName": 1,
            "mukhiyaPhoto": 1,
            "relocationOption": 1,
        }

        # -------- DB Call (Safe, no no_cursor_timeout) --------
        cursor = families.find(q, projection).sort("mukhiyaName", ASCENDING)

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

        f = families.find_one({"familyId": family_id}, {"_id": 0})
        if not f:
            return make_response(True, "Family not found", status=404)
        

        return make_response(False, "Family fetched successfully", result=f, status=200)

    except Exception as e:
        return make_response(True, "Internal server error", status=500)

#Static API's FOR ADMIN PURPOSE

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
                        currentStage="INIT",
                        updates=[],
                        stagesCompleted=[]
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
                    updates=[],
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


        forbidden_fields = {"updates", "currentStage", "statusHistory","stagesCompleted"}
        if any(f in payload for f in forbidden_fields):
            return make_response(True, f"Fields {forbidden_fields} are not allowed at insert", status=400)

        # ✅ Validate & normalize user input (no familyId expected here)
        try:
            family_obj = Family(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # ✅ Generate familyId automatically based on villageId
        new_family_id = get_next_family_id(db, family_obj.villageId)
        members_complete = [
            Member(
                **m.model_dump(),
                currentStage="INIT",
                updates=[],
                stagesCompleted=[]
            )
            for m in family_obj.members
        ]
        # ✅ Build FamilyComplete object
        fam_complete = FamilyComplete(
            familyId=new_family_id,
            currentStage="INIT",     # 👈 system-managed
            stagesCompleted=[],updates=[],
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
        
        forbidden_fields = {"updates", "currentStage", "statusHistory", "familyId","stagesCompleted"}
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



#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
@family_bp.route("/family_updates/insert/<familyId>", methods=["POST"])
def insert_family_update(familyId):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing userId or req body", status=400)
        try:
            verification_obj = UpdatesInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)
        # 1️⃣ Fetch family
# 1️⃣ Fetch family
        family = families.find_one({"familyId": familyId}, {"_id": 0})
        if not family:
            return make_response(True, "Family not found", status=404)

        # Use family dict directly instead of validating with FamilyComplete
        fam = family


        # 2️⃣ Fetch option details
        option = options.find_one({"optionId": fam.get("relocationOption")}, {"_id": 0})
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
        update_id = get_next_family_update_id(db, fam.villageId, option["optionId"])

        now = dt.datetime.utcnow().isoformat()
        history=StatusHistory(
            status=1,
            comments=verification_obj.notes,
            verifier=userId,
            time=str(now)
        )
        # 5️⃣ Create Updates entry
        fam_update = Updates(
            updateId=update_id,
            status=1,
            verifiedBy=userId,
            insertedBy=userId,
            verifiedAt=str(now),
            statusHistory=[history.model_dump()],
            **verification_obj.model_dump(exclude_none=True)
        )

        # 6️⃣ Insert into DB
        families.update_one(
            {"familyId": familyId},
            {
                "$push": {"updates": fam_update.model_dump(exclude_none=True)},
                "$addToSet": {"stagesCompleted": current_stage},
            },
        )
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

@family_bp.route("/member_updates/insert/<familyId>", methods=["POST"])
def insert_member_update(familyId):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing userId or req body", status=400)

        # Required fields
        name = payload.get("name")              # update name
        nameUpdate = payload.get("nameUpdate")  # existing member name
        age = payload.get("age")
        gender = payload.get("gender")
        current_stage = payload.get("currentStage")
        notes = payload.get("notes", "")

        if not all([name, nameUpdate, age, gender, current_stage]):
            return make_response(True, "Missing required fields", status=400)

        # 1️⃣ Fetch family (raw dict, no strict Pydantic validation)
        family_doc = families.find_one({"familyId": familyId}, {"_id": 0})
        if not family_doc:
            return make_response(True, "Family not found", status=404)

        # 2️⃣ Find the member directly from dict (use nameUpdate)
        members = family_doc.get("members", [])
        member = next(
            (m for m in members if m.get("name") == nameUpdate 
                                and m.get("age") == age 
                                and m.get("gender", "").lower() == gender.lower()),
            None
        )
        if not member:
            return make_response(True, "Member not found in family", status=404)

        # 3️⃣ Validate eligibility
        if int(member.get("age", 0)) < 18 or member.get("gender", "").upper() not in ["M", "MALE"]:
            return make_response(True, "Member not eligible (must be male and >=18)", status=400)

        # 4️⃣ Fetch relocation option & stages
        option = options.find_one({"optionId": member.get("relocationOption")}, {"_id": 0})
        if not option:
            return make_response(True, "Relocation option not found", status=404)

        stages = [s for s in option.get("stages", []) if not s.get("deleted", False)]
        stage_ids = [s["stageId"] for s in stages]

        if current_stage not in stage_ids:
            return make_response(True, f"Invalid stageId: {current_stage}", status=400)

        # 5️⃣ Validate stage order
        stagesCompleted = member.get("stagesCompleted", [])
        current_index = stage_ids.index(current_stage)
        required_stages = stage_ids[:current_index]
        missing_stages = [s for s in required_stages if s not in stagesCompleted]
        if missing_stages:
            missing_names = [s["name"] for s in stages if s["stageId"] in missing_stages]
            return make_response(
                True,
                f"Cannot verify {current_stage} yet. Missing previous stages: {', '.join(missing_names)}",
                status=400,
            )

        # 6️⃣ Generate member updateId
        update_id = get_next_member_update_id(db, family_doc["familyId"], option["optionId"])

        now = dt.datetime.utcnow().isoformat()
        history = StatusHistory(
            status=1,
            comments=notes,
            verifier=userId,
            time=str(now)
        )

        # 7️⃣ Build update object (use update name = `name`)
        mem_update = Updates(
            updateId=update_id,
            currentStage=current_stage,
            notes=notes,
            status=1,
            name=name,  # <-- update name stored
            verifiedBy=userId,
            insertedBy=userId,
            verifiedAt=str(now),
            statusHistory=[history.model_dump()]
        )

        # 8️⃣ Update the member inside family (match using member’s original details)
        families.update_one(
            {"familyId": familyId, "members.name": nameUpdate, "members.age": age, "members.gender": gender},
            {
                "$push": {"members.$.updates": mem_update.model_dump(exclude_none=True)},
                "$addToSet": {"members.$.stagesCompleted": current_stage},
                "$set": {"members.$.currentStage": current_stage},
            }
        )

        return make_response(
            False,
            f"Member update {update_id} inserted successfully",
            result=mem_update.model_dump(),
            status=200
        )

    except ValidationError as ve:
        return validation_error_response(ve)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", status=500)

@family_bp.route("/verification/verify", methods=["POST"])
def verify_update():
    """
    Verify family or member updates.
    - If type = 'family'  -> require familyId
    - If type = 'member'  -> require familyId, name, age, gender
    Common: updateId, userId, status(1/-1), comments
    """
    try:
        payload = request.get_json(force=True)
        verification_type = payload.get("type")   # 'family' or 'member'
        familyId = payload.get("familyId")
        updateId = payload.get("updateId")
        userId = payload.get("userId")
        status = payload.get("status")  # 1=accept, -1=send back
        comments = payload.get("comments", "")

        # Validation
        if verification_type not in ["family", "member"]:
            return make_response(True, "Invalid type (must be 'family' or 'member')", status=400)
        if not familyId or not updateId or not userId or not comments or status not in [1, -1]:
            return make_response(True, "Missing required fields", status=400)

        # Fetch family
        family = families.find_one({"familyId": familyId})
        if not family:
            return make_response(True, "Family not found", status=404)

        # Select updates array depending on type
        updates_list = []
        if verification_type == "family":
            updates_list = family.get("updates", [])
        else:  # member
            name, age, gender = payload.get("name"), payload.get("age"), payload.get("gender")
            if not name or not age or not gender:
                return make_response(True, "Missing member details (name, age, gender)", status=400)
            member = next((m for m in family.get("members", []) 
                           if m["name"] == name and m["age"] == age and m["gender"] == gender), None)
            if not member:
                return make_response(True, "Member not found", status=404)
            updates_list = member.get("updates", [])

        # Find update
        update = next((u for u in updates_list if u["updateId"] == updateId), None)
        if not update:
            return make_response(True, "Update not found", status=404)
        if update.get("deleted", False):
            return make_response(True, "Cannot verify deleted update", status=400)

        # Update status
        now = dt.datetime.utcnow().isoformat()
        previous_status = update.get("status", 1)
        final_status = min(max(previous_status + status, 1), 4)

        new_history = {
            "status": final_status,
            "comments": comments,
            "verifier": userId,
            "time": now
        }

        # Mongo update query
        if verification_type == "family":
            families.update_one(
                {"familyId": familyId, "updates.updateId": updateId},
                {
                    "$set": {
                        "updates.$.status": final_status,
                        "updates.$.verifiedBy": userId,
                        "updates.$.verifiedAt": now,
                    },
                    "$push": {"updates.$.statusHistory": new_history}
                }
            )
        else:  # member
            families.update_one(
                {"familyId": familyId, "members.name": name, "members.age": age, "members.gender": gender, "members.updates.updateId": updateId},
                {
                    "$set": {
                        "members.$[m].updates.$[u].status": final_status,
                        "members.$[m].updates.$[u].verifiedBy": userId,
                        "members.$[m].updates.$[u].verifiedAt": now,
                    },
                    "$push": {"members.$[m].updates.$[u].statusHistory": new_history}
                },
                array_filters=[{"m.name": name, "m.age": age, "m.gender": gender}, {"u.updateId": updateId}]
            )

        return make_response(False, "Verification status updated successfully", result=new_history)

    except Exception as e:
        return make_response(True, f"Error verifying update: {str(e)}", status=500)


@family_bp.route("/updates/<familyId>", methods=["GET"])
def get_updates(familyId):
    """
    Fetch updates for family or member
    Query params:
      - type = 'family' or 'member'
      - deleted = true/false (default: false)
      - For member: also pass name, age, gender
    """
    try:
        update_type = request.args.get("type")  # family | member
        deleted_flag = request.args.get("deleted", "false").lower() == "true"

        if update_type not in ["family", "member"]:
            return make_response(True, "Invalid type (must be 'family' or 'member')", status=400)

        # 1️⃣ Fetch family
        family = families.find_one({"familyId": familyId}, {"_id": 0})
        if not family:
            return make_response(True, "Family not found", status=404)

        # 2️⃣ Determine updates source
        updates = []
        if update_type == "family":
            updates = [u for u in family.get("updates", []) if u.get("deleted", False) == deleted_flag]

        else:  # member updates
            name = request.args.get("name")
            age = request.args.get("age", type=int)
            gender = request.args.get("gender")

            if not all([name, age, gender]):
                return make_response(True, "Missing member details (name, age, gender)", status=400)

            member = next(
                (m for m in family.get("members", [])
                 if m["name"] == name and m["age"] == age and m["gender"].lower() == gender.lower()),
                None
            )
            if not member:
                return make_response(True, "Member not found", status=404)

            updates = [u for u in member.get("updates", []) if u.get("deleted", False) == deleted_flag]

        # 3️⃣ Return response
        if not updates:
            msg = "No deleted updates found" if deleted_flag else "No updates found"
            return make_response(True, msg, status=404)

        return make_response(
            False,
            "Updates fetched successfully",
            result={"count": len(updates), "items": updates}
        )

    except Exception as e:
        return make_response(True, f"Error fetching updates: {str(e)}", status=500)
