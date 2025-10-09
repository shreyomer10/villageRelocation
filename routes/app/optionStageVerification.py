

import datetime as dt
import logging

from flask import  Blueprint, logging,request, jsonify
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from utils.tokenAuth import auth_required
from models.counters import get_next_family_update_id, get_next_member_update_id
from utils.helpers import STATUS_TRANSITIONS, make_response, nowIST, validation_error_response
from models.family import StatusHistory, Updates, UpdatesInsert, UpdatesUpdate
from config import JWT_EXPIRE_MIN, db

from pymongo import errors  
from pymongo import errors  

families = db.testing
options = db.options
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
        user_id = decoded_data.get("userId")
        user_role=decoded_data.get("role")
        if not user_id or not user_role:
            return make_response(True, "Invalid token: missing userId", status=400)
        if user_id!=userId:
            return make_response(True, "Unauthorized access", status=403)
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
                "$set": {"currentStage": current_stage},  # ✅ maintain currentStage

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

@option_verification_BP.route("/member_updates/insert/<familyId>", methods=["POST"])
@auth_required
def insert_member_update(decoded_data,familyId):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing userId or req body", status=400)
        user_id = decoded_data.get("userId")
        user_role=decoded_data.get("role")
        if not user_id or not user_role:
            return make_response(True, "Invalid token: missing userId", status=400)
        if user_id!=userId:
            return make_response(True, "Unauthorized access", status=403)
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
            (m for m in members 
            if m.get("name","").strip().lower() == nameUpdate.strip().lower()
            and str(m.get("age")) == str(age)
            and m.get("gender","").lower() == gender.lower()),
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

        now = nowIST()
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

@option_verification_BP.route("/family_updates/<familyId>/<updateId>", methods=["PUT"])
@auth_required
def update_family_update(decoded_data,familyId, updateId):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing request body or userId", status=400)
        user_id = decoded_data.get("userId")
        user_role=decoded_data.get("role")
        if not user_id or not user_role:
            return make_response(True, "Invalid token: missing userId", status=400)
        if user_id!=userId:
            return make_response(True, "Unauthorized access", status=403)
        # Validate payload using Pydantic
        try:
            update_obj = UpdatesUpdate(**payload)  # similar to VillageUpdatesUpdate
        except ValidationError as ve:
            return validation_error_response(ve)

        # Fetch family document
        family_doc = families.find_one({"familyId": familyId})
        if not family_doc:
            return make_response(True, "Family not found", status=404)

        # Locate the specific update
        update_item = next(
            (u for u in family_doc.get("updates", []) if u["updateId"] == updateId),
            None
        )

        if not update_item:
            return make_response(True, "Update not found", status=404)
        if update_item.get("deleted", False):
            return make_response(True, "Cannot update deleted update", status=400)
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

        # Update the specific update inside the updates array
        families.update_one(
            {"familyId": familyId, "updates.updateId": updateId},
            {"$set": {f"updates.$.{k}": v for k, v in update_dict.items()}}
        )

        # Optional: Recompute currentStage if needed
        # If the update being modified changes its status, you may want to recompute
        # family_doc["currentStage"] = max of all verified updates in order of option stages

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

@option_verification_BP.route("/member_updates/<familyId>/<updateId>", methods=["PUT"])
@auth_required
def update_member_update(decoded_data,familyId, updateId):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing request body or userId", status=400)
        user_id = decoded_data.get("userId")
        user_role=decoded_data.get("role")
        if not user_id or not user_role:
            return make_response(True, "Invalid token: missing userId", status=400)
        if user_id!=userId:
            return make_response(True, "Unauthorized access", status=403)
        # Validate payload
        try:
            update_obj = UpdatesUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # Fetch family document
        family_doc = families.find_one({"familyId": familyId})
        if not family_doc:
            return make_response(True, "Family not found", status=404)

        # Locate the member who owns this update
        member_item = None
        for m in family_doc.get("members", []):
            update_item = next(
                (u for u in m.get("updates", []) if u["updateId"] == updateId),
                None
            )
            if update_item:
                member_item = (m, update_item)
                break

        if not member_item:
            return make_response(True, "Update not found for any member", status=404)

        member, update_item = member_item

        if update_item.get("deleted", False):
            return make_response(True, "Cannot update deleted update", status=400)
        previous_status = update_item.get("status", 1) 
        if previous_status >=3:
            return make_response(True, "Cannot update freezed", status=400)

        # Stage should not be changed
        # if update_obj.currentStage and update_obj.currentStage != update_item.get("currentStage"):
        #     return make_response(True, "Updating currentStage not allowed", status=400)

        # Build updated dictionary
        now = nowIST()
        update_dict = update_obj.model_dump(exclude_none=True)
        update_dict.update({"verifiedAt": now, "verifiedBy": userId})

        # Update the specific update inside the member's updates array
        families.update_one(
            {
                "familyId": familyId,
                "members.name": member.get("name"),
                "members.age": member.get("age"),
                "members.gender": member.get("gender")
            },
            {
                "$set": {f"members.$.updates.$[u].{k}": v for k, v in update_dict.items()}
            },
            array_filters=[{"u.updateId": updateId}]
        )

        # Optional: Update member's currentStage if needed
        # stagesCompleted can also be recomputed if update status affects it

        return make_response(
            False,
            f"Member update {updateId} modified successfully",
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

        update_type = payload.get("type")  # "family" or "member"
        familyId = payload.get("familyId")
        updateId = payload.get("updateId")
        userId = payload.get("userId")

        if not all([update_type, familyId, updateId, userId]):
            return make_response(True, "Missing required fields", status=400)
        user_id = decoded_data.get("userId")
        user_role=decoded_data.get("role")
        if not user_id or not user_role:
            return make_response(True, "Invalid token: missing userId", status=400)
        if user_id!=userId:
            return make_response(True, "Unauthorized access", status=403)
        # Fetch family
        family_doc = families.find_one({"familyId": familyId})
        if not family_doc:
            return make_response(True, "Family not found", status=404)

        if update_type == "family":
            # ---------- Family Update ----------
            update_item = next(
                (u for u in family_doc.get("updates", []) if u["updateId"] == updateId and not u.get("deleted", False)),
                None
            )
            if not update_item:
                return make_response(True, "Update not found", status=404)
            previous_status = update_item.get("status", 1) 
            if previous_status >=2:
                return make_response(True, "Cannot delete freezed verifications.", status=400)
            stage_to_remove = update_item.get("currentStage")

            # Count non-deleted updates for this stage
            non_deleted_count = sum(
                1 for u in family_doc.get("updates", []) 
                if u.get("currentStage") == stage_to_remove and not u.get("deleted", False)
            )

            update_ops = {"$set": {"updates.$.deleted": True}}
            if non_deleted_count == 1:
                update_ops["$pull"] = {"stagesCompleted": stage_to_remove}

            families.update_one(
                {"familyId": familyId, "updates.updateId": updateId},
                update_ops
            )

            # Recalculate currentStage
            remaining_updates = [
                u for u in family_doc.get("updates", []) if not u.get("deleted", False) and u["updateId"] != updateId
            ]
            new_current_stage = remaining_updates[-1]["currentStage"] if remaining_updates else None
            families.update_one(
                {"familyId": familyId},
                {"$set": {"currentStage": new_current_stage}}
            )

        elif update_type == "member":
            # ---------- Member Update ----------
            memberName = payload.get("name")
            age = payload.get("age")
            gender = payload.get("gender")

            if not all([memberName, age, gender]):
                return make_response(True, "Missing member identifiers", status=400)

            members = family_doc.get("members", [])
            member = next(
                (m for m in members 
                 if m.get("name","").strip().lower() == memberName.strip().lower()
                 and str(m.get("age")) == str(age)
                 and m.get("gender","").lower() == gender.lower()),
                None
            )
            if not member:
                return make_response(True, "Member not found", status=404)

            update_item = next(
                (u for u in member.get("updates", []) if u["updateId"] == updateId and not u.get("deleted", False)),
                None
            )
            if not update_item:
                return make_response(True, "Update not found", status=404)
            previous_status = update_item.get("status", 1) 
            if previous_status >=2:
                return make_response(True, "Cannot delete freezed verifications.", status=400)
            stage_to_remove = update_item.get("currentStage")

            non_deleted_count = sum(
                1 for u in member.get("updates", []) 
                if u.get("currentStage") == stage_to_remove and not u.get("deleted", False)
            )

            update_ops = {"$set": {"members.$.updates.$[u].deleted": True}}
            array_filters = [{"u.updateId": updateId}]
            if non_deleted_count == 1:
                update_ops["$pull"] = {"members.$.stagesCompleted": stage_to_remove}

            families.update_one(
                {"familyId": familyId, "members.name": memberName, "members.age": age, "members.gender": gender},
                update_ops,
                array_filters=array_filters
            )

            # Recalculate member currentStage
            remaining_updates = [
                u for u in member.get("updates", []) if not u.get("deleted", False) and u["updateId"] != updateId
            ]
            new_current_stage = remaining_updates[-1]["currentStage"] if remaining_updates else None
            families.update_one(
                {"familyId": familyId, "members.name": memberName, "members.age": age, "members.gender": gender},
                {"$set": {"members.$.currentStage": new_current_stage}}
            )

        else:
            return make_response(True, "Invalid type. Must be 'family' or 'member'", status=400)

        return make_response(False, f"{update_type.capitalize()} update {updateId} deleted successfully")

    except Exception as e:
        return make_response(True, f"Error deleting update: {str(e)}", status=500)


@option_verification_BP.route("/verification/verify", methods=["POST"])
@auth_required
def verify_update(decoded_data):
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
        user_id = decoded_data.get("userId")
        user_role=decoded_data.get("role")
        if not user_id or not user_role:
            return make_response(True, "Invalid token: missing userId", status=400)
        if user_id!=userId:
            return make_response(True, "Unauthorized access", status=403)

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
        previous_status = update.get("status", 1) 
        
        required_status = STATUS_TRANSITIONS.get(user_role)
        if not required_status or previous_status != required_status:
            return make_response(True, f"Unauthorized: {user_role} cannot verify status {previous_status}", status=403)


        # Update status
        now = nowIST()
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


@option_verification_BP.route("/updates/<familyId>", methods=["GET"])
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
            return make_response(True, "Family not found", result={"count": 0, "items": []},status=404)

        # 2️⃣ Determine updates source
        updates = []
        if update_type == "family":
            updates = [u for u in family.get("updates", []) if u.get("deleted", False) == deleted_flag]

        else:  # member updates
            name = request.args.get("name")
            age = request.args.get("age")
            gender = request.args.get("gender")

            if not all([name, age, gender]):
                return make_response(True, "Missing member details (name, age, gender)", result={"count": 0, "items": []},status=400)

            member = next(
                (m for m in family.get("members", [])
                if m["name"].strip().lower() == name.strip().lower()
                and str(m["age"]) == str(age)
                and m["gender"].lower() == gender.lower()),
                None
            )

            if not member:
                return make_response(True, "Member not found",result={"count": 0, "items": []}, status=404)

            updates = [u for u in member.get("updates", []) if u.get("deleted", False) == deleted_flag]

        # 3️⃣ Return response
        if not updates:
            msg = "No deleted updates found" if deleted_flag else "No updates found"
            return make_response(True, msg, result={"count": 0, "items": []},status=404)

        return make_response(
            False,
            "Updates fetched successfully",
            result={"count": len(updates), "items": updates}
        )

    except Exception as e:
        return make_response(True, f"Error fetching updates: {str(e)}",result={"count": 0, "items": []}, status=500)
