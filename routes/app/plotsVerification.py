
import datetime as dt
from flask import Blueprint,request, jsonify
from pydantic import ValidationError
from utils.tokenAuth import auth_required
from models.stages import FieldLevelVerification, FieldLevelVerificationInsert, FieldLevelVerificationUpdate, Plots, PlotsInsert, PlotsUpdate, statusHistory
from models.counters import get_next_plot_id, get_next_verification_id
from utils.helpers import STATUS_TRANSITIONS, make_response, nowIST, validation_error_response
from config import  db

from pymongo import errors  
buildings = db.buildings
villages = db.villages
plots = db.plots
families = db.testing

plots_BP = Blueprint("plots",__name__)



# ------------------ PLOTS ----  --------------
@plots_BP.route("/plots/insert", methods=["POST"])
def insert_plot():
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        # Validate input
        try:
            plot_obj = PlotsInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)
        if plot_obj.stagesCompleted or plot_obj.docs:
            return make_response(True, "Wrong Request Parameter", status=400)


        # Check villageId exists
        village_exists = villages.find_one({"villageId": plot_obj.villageId})
        if not village_exists:
            return make_response(True, f"Village with ID {plot_obj.villageId} does not exist", status=404)

        # Check typeId exists (Building type)
        type_exists = buildings.find_one({
            "typeId": plot_obj.typeId,
            "villageId": plot_obj.villageId,
            "deleted": False
        })
        if not type_exists:
            return make_response(True, f"Building type with ID {plot_obj.typeId} does not exist in this village", status=404)

        # Check familyId exists (if provided)
        if plot_obj.familyId:
            family_exists = families.find_one({"familyId": plot_obj.familyId})
            if not family_exists:
                return make_response(True, f"Family with ID {plot_obj.familyId} does not exist", status=404)

        # Generate plotId
        new_plot_id = get_next_plot_id(db, plot_obj.villageId, plot_obj.typeId)

        # Build stagesCompleted dynamically from docs.currentStage
        # stages_completed = []
        # for doc in plot_obj.docs or []:
        #     if doc.currentStage and doc.currentStage not in stages_completed:
        #         stages_completed.append(doc.currentStage)

        # Construct full plot object
        plot_complete = Plots(
            plotId=new_plot_id,
            stagesCompleted=[],   # auto-populated from docs
            docs=[],
            **plot_obj.model_dump(exclude_none=True, exclude={"stagesCompleted","docs"})
        )

        # Insert into Mongo
        plot_dict = plot_complete.model_dump(exclude_none=True)
        plots.insert_one(plot_dict)
        plot_dict.pop("_id", None)

        # If familyId exists, update family with this plotId
        if plot_obj.familyId:
            families.update_one(
                {"familyId": plot_obj.familyId},
                {"$push": {"plots": new_plot_id}}
            )

        return make_response(False, "Plot inserted successfully", result=plot_dict, status=200)

    except Exception as e:
        return make_response(True, f"Error inserting plot: {str(e)}", status=500)

@plots_BP.route("/plots/<plotId>", methods=["PUT"])
def update_plot(plotId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        # docs should not be updated via this API
        if "docs" in payload:
            return make_response(True, "Updating docs is not allowed here", status=400)

        try:
            update_obj = PlotsUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)
        # stagesCompleted should not be updated manually
        if "stagesCompleted" in payload:
            return make_response(True, "Updating stagesCompleted is not allowed here", status=400)

        plot = plots.find_one({"plotId": plotId, "deleted": False})
        if not plot:
            return make_response(True, "Plot not found", status=404)

        # Validate typeId and villageId if provided
        if update_obj.villageId or update_obj.typeId:
            type_exists = buildings.find_one({
                "typeId": update_obj.typeId or plot["typeId"],
                "villageId": update_obj.villageId or plot["villageId"],
                "deleted": False
            })
            if not type_exists:
                return make_response(True, "Invalid typeId or villageId", status=404)

        # Validate familyId if provided
        if update_obj.familyId:
            family_exists = families.find_one({"familyId": update_obj.familyId})
            if not family_exists:
                return make_response(True, f"Family with ID {update_obj.familyId} does not exist", status=404)

        # ✅ Only update fields actually present in request
        update_dict = update_obj.model_dump(
            exclude_unset=True,   # <-- important
            exclude_none=True,
            exclude={"docs", "stagesCompleted"}
        )

        if not update_dict:
            return make_response(True, "No valid fields to update", status=400)

        plots.update_one({"plotId": plotId}, {"$set": update_dict})

        return make_response(False, "Plot updated successfully", result=update_dict)

    except Exception as e:
        return make_response(True, f"Error updating plot: {str(e)}", status=500)


@plots_BP.route("/plots/<plotId>", methods=["DELETE"])
def delete_plot(plotId):
    try:
        result = plots.update_one({"plotId": plotId}, {"$set": {"deleted": True}})
        if result.matched_count == 0:
            return make_response(True, "Plot not found", status=404)
        return make_response(False, "Plot deleted successfully")
    except Exception as e:
        return make_response(True, f"Error deleting plot: {str(e)}", status=500)


@plots_BP.route("/plots/<villageId>", methods=["GET"])
def get_plots(villageId):
    try:
        typeId = request.args.get("typeId")
        query = {"villageId": villageId, "deleted": False}
        if typeId:
            query["typeId"] = typeId

        docs = list(plots.find(query, {"_id": 0,"docs":0}))

        if not docs:
            return make_response(True, "No plots found",result={"count": 0, "items": []}, status=404)

        return make_response(False, "Plots fetched successfully", result={"count": len(docs), "items": docs}, status=200)
    except Exception as e:
        return make_response(True, f"Error fetching plots: {str(e)}",result={"count": 0, "items": []}, status=500)

@plots_BP.route("/plots/<villageId>/<plotId>", methods=["GET"])
def get_plot_complete(villageId,plotId):
    try:
        typeId = request.args.get("typeId")
        query = {"villageId": villageId, "deleted": False,"plotId":plotId}
        if typeId:
            query["typeId"] = typeId

        docs = list(plots.find(query, {"_id": 0}))

        if not docs:
            return make_response(True, "No plots found",result={"count": 0, "items": []}, status=404)

        return make_response(False, "Plots fetched successfully", result={"count": len(docs), "items": docs}, status=200)
    except Exception as e:
        return make_response(True, f"Error fetching plots: {str(e)}",result={"count": 0, "items": []}, status=500)
    


@plots_BP.route("/deleted_plots/<villageId>", methods=["GET"])
def get_deleted_plots(villageId):
    try:
        typeId = request.args.get("typeId")
        query = {"villageId": villageId, "deleted": True}
        if typeId:
            query["typeId"] = typeId

        docs = list(plots.find(query, {"_id": 0}))
        if not docs:
            return make_response(True, "No deleted plots found", result={"count": 0, "items": []},status=404)
        return make_response(False, "Deleted plots fetched successfully", result={"count": len(docs), "items": docs}, status=200)
    except Exception as e:
        return make_response(True, f"Error fetching deleted plots: {str(e)}",result={"count": 0, "items": []}, status=500)


# ------------------ FIELD LEVEL VERIFICATION ------------------


@plots_BP.route("/field_verification/insert/<plotId>", methods=["POST"])
@auth_required
def insert_verification(decoded_data,plotId):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing request body or userId", status=400)
        user_id = decoded_data.get("userId")
        user_role=decoded_data.get("role")
        activated=bool(decoded_data.get("activated"))
        #print(activated)



        if not user_id or not user_role:
            return make_response(True, "Invalid token: missing userId", status=400)
        if user_id!=userId:
            return make_response(True, "Unauthorized access", status=403)
        if not activated:
            return make_response(True, "User is not activated. Contact DD", status=400)
        try:
            verification_obj = FieldLevelVerificationInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # Fetch plot
        plot = plots.find_one({"plotId": plotId, "deleted": False})
        if not plot:
            return make_response(True, "Plot not found", status=404)

        # Fetch building stages (respect order, skip deleted)
        building = buildings.find_one(
            {"typeId": plot["typeId"], "villageId": plot["villageId"], "deleted": False}
        )
        if not building:
            return make_response(True, "Building type not found", status=404)

        # Fetch ordered stages (skipping deleted)
        stages = [s for s in building.get("stages", []) if not s.get("deleted", False)]
        stage_ids = [s["stageId"] for s in stages]

        current_stage = verification_obj.currentStage

        # Ensure stage is valid
        if current_stage not in stage_ids:
            return make_response(True, f"Invalid stageId: {current_stage}", status=400)

        completed_stages = plot.get("stagesCompleted", [])

        # Find index of current stage
        current_index = stage_ids.index(current_stage)

        # Collect all stages before this one
        required_stages = stage_ids[:current_index]

        # Find which required stages are missing in completed
        missing_stages = [s for s in required_stages if s not in completed_stages]

        if missing_stages:
            # Get stage names for readability
            missing_names = [
                stage["name"] for stage in stages if stage["stageId"] in missing_stages
            ]
            return make_response(
                True,
                f"Cannot verify {current_stage} yet. Missing previous stages: {', '.join(missing_names)}",
                status=400,
            )

        # Passed validation → insert verification
        new_verification_id = get_next_verification_id(db, plot["villageId"], plot["typeId"])
        now = nowIST()
        history=statusHistory(
            status=1,
            comments=verification_obj.notes,
            verifier=userId,
            time=str(now)
        )

        verification_complete = FieldLevelVerification(
            status=1,
            verificationId=new_verification_id,
            verifiedAt=str(now),
            verifiedBy=userId,
            insertedBy=userId,
            statusHistory=[history.model_dump()],
            **verification_obj.model_dump(exclude_none=True),
        )

        # Update plot: add verification and mark stage completed
        plots.update_one(
            {"plotId": plotId},
            {
                "$push": {"docs": verification_complete.model_dump(exclude_none=True)},
                "$addToSet": {"stagesCompleted": current_stage},
            },
        )

        return make_response(
            False,
            "Verification inserted successfully",
            result=verification_complete.model_dump(exclude_none=True),
        )

    except Exception as e:
        return make_response(True, f"Error inserting verification: {str(e)}", status=500)


@plots_BP.route("/field_verification/<plotId>/<verificationId>", methods=["PUT"])
@auth_required
def update_verification(decoded_data,plotId, verificationId):
    try:
        payload = request.get_json(force=True)
        userId = payload.pop("userId", None)
        if not payload or not userId:
            return make_response(True, "Missing request body or userId", status=400)
        user_id = decoded_data.get("userId")
        user_role=decoded_data.get("role")
        activated=bool(decoded_data.get("activated"))
        #print(activated)



        if not user_id or not user_role:
            return make_response(True, "Invalid token: missing userId", status=400)
        if user_id!=userId:
            return make_response(True, "Unauthorized access", status=403)
        if not activated:
            return make_response(True, "User is not activated. Contact DD", status=400)
        try:
            verification_obj = FieldLevelVerificationUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)
        if verification_obj.currentStage:
            return make_response(True, "Updating current stage or status not allowed ", status=400)


        plot = plots.find_one({"plotId": plotId, "deleted": False})
        if not plot:
            return make_response(True, "Plot not found", status=404)

        verification = next((d for d in plot.get("docs", []) if d["verificationId"] == verificationId), None)
        if not verification:
            return make_response(True, "Verification not found", status=404)
        if verification.get("deleted", False):
            return make_response(True, "Cannot update deleted verification", status=400)
        previous_status = verification.get("status", 1) 
        if previous_status >=3:
            return make_response(True, "Cannot update freezed", status=400)


        now = nowIST()

        update_dict = verification_obj.model_dump(exclude_none=True)
        update_dict.update({"verifiedAt": now})
        history_entry = {
            "status": 1,  # 0 = normal update
            "comments": update_dict.get("notes", ""),
            "verifier": userId,
            "time": now
        }
        # Perform the update
        plots.update_one(
            {"plotId": plotId, "docs.verificationId": verificationId},
            {
                "$set": {f"docs.$.{k}": v for k, v in update_dict.items()},
                "$push": {"docs.$.statusHistory": history_entry}
            }
        )
        return make_response(False, "Verification updated successfully", result=update_dict)
    except Exception as e:
        return make_response(True, f"Error updating verification: {str(e)}", status=500)


@plots_BP.route("/field_verification/verify/<plotId>/<verificationId>", methods=["POST"])
@auth_required
def verify_verification(decoded_data,plotId, verificationId):
    try:
    
        payload = request.get_json(force=True)
        userId = payload.get("userId")
        status = payload.get("status")  # 1 = accept, -1 = send back
        comments = payload.get("comments", "")

        if not userId or not comments or status not in [1, -1]:
            return make_response(True, "Missing userId ,comments or invalid status (must be 1 or -1)", status=400)
        user_id = decoded_data.get("userId")
        user_role=decoded_data.get("role")
        activated=bool(decoded_data.get("activated"))
        #print(activated)



        if not user_id or not user_role:
            return make_response(True, "Invalid token: missing userId", status=400)
        if user_id!=userId:
            return make_response(True, "Unauthorized access", status=403)
        if not activated:
            return make_response(True, "User is not activated. Contact DD", status=400)

        # Fetch plot
        plot = plots.find_one({"plotId": plotId, "deleted": False})
        if not plot:
            return make_response(True, "Plot not found", status=404)

        # Find verification
        verification = next((d for d in plot.get("docs", []) if d["verificationId"] == verificationId), None)
        if not verification:
            return make_response(True, "Verification not found", status=404)
        if verification.get("deleted", False):
            return make_response(True, "Cannot verify deleted verification", status=400)

        now = nowIST()
        previous_status = verification.get("status", 1) 
        
        required_status = STATUS_TRANSITIONS.get(user_role)
        if not required_status or previous_status != required_status:
            return make_response(True, f"Unauthorized: {user_role} cannot verify status {previous_status}", status=403)

        final_status = min(max(previous_status + status, 1), 4)
        new_history = {
            "status":final_status,   # 1 = accept, -1 = send back
            "comments": comments,
            "verifier": userId,
            "time": now
        }

        plots.update_one(
            {"plotId": plotId, "docs.verificationId": verificationId},
            {
                "$set": {
                    "docs.$.status":final_status,
                    "docs.$.verifiedBy": userId,
                    "docs.$.verifiedAt": now,
                },
                "$push": {"docs.$.statusHistory": new_history}
            }
        )

        return make_response(False, "Verification status updated successfully", result=new_history)

    except Exception as e:
        return make_response(True, f"Error verifying verification: {str(e)}", status=500)


@plots_BP.route("/field_verification/<plotId>/<verificationId>", methods=["DELETE"])
@auth_required
def delete_verification(decoded_data,plotId, verificationId):
    try:
        payload = request.get_json(force=True)
        userId = payload.get("userId") if payload else None
        comments = payload.get("comments", "Deleted by user") if payload else "Deleted by user"

        if not userId:
            return make_response(True, "Missing userId in request body", status=400)
        user_id = decoded_data.get("userId")
        user_role=decoded_data.get("role")
        activated=bool(decoded_data.get("activated"))
        #print(activated)



        if not user_id or not user_role:
            return make_response(True, "Invalid token: missing userId", status=400)
        if user_id!=userId:
            return make_response(True, "Unauthorized access", status=403)
        if not activated:
            return make_response(True, "User is not activated. Contact DD", status=400)
        plot = plots.find_one({"plotId": plotId, "deleted": False})
        if not plot:
            return make_response(True, "Plot not found", status=404)

        verification = next((d for d in plot.get("docs", []) if d["verificationId"] == verificationId), None)
        if not verification:
            return make_response(True, "Verification not found", status=404)
        previous_status = verification.get("status", 1) 
        if previous_status >=2:
            return make_response(True, "Cannot update freezed verifications.", status=400)
        now = nowIST()

        # History entry for deletion
        history_entry = {
            "status": -1,  # special code for "deleted"
            "comments": comments,
            "verifier": userId,
            "time": now
        }

        plots.update_one(
            {"plotId": plotId, "docs.verificationId": verificationId},
            {
                "$set": {"docs.$.deleted": True},
                "$push": {"docs.$.statusHistory": history_entry}
            }
        )

        return make_response(False, "Verification deleted successfully")

    except Exception as e:
        return make_response(True, f"Error deleting verification: {str(e)}", status=500)


@plots_BP.route("/field_verification/<plotId>", methods=["GET"])
def get_verifications(plotId):
    try:
        plot = plots.find_one({"plotId": plotId, "deleted": False}, {"_id": 0})
        if not plot:
            return make_response(True, "Plot not found",result={"count": 0, "items": []}, status=404)

        verifications = [d for d in plot.get("docs", []) if not d.get("deleted", False)]
        if not verifications:
            return make_response(True, "No verifications found", result={"count": 0, "items": []},status=404)

        return make_response(False, "Verifications fetched successfully", result={"count": len(verifications), "items": verifications})
    except Exception as e:
        return make_response(True, f"Error fetching verifications: {str(e)}", result={"count": 0, "items": []},status=500)


@plots_BP.route("/deleted_field_verification/<plotId>", methods=["GET"])
def get_deleted_verifications(plotId):
    try:
        plot = plots.find_one({"plotId": plotId}, {"_id": 0})
        if not plot:
            return make_response(True, "Plot not found", result={"count": 0, "items": []},status=404)

        verifications = [d for d in plot.get("docs", []) if d.get("deleted", False)]
        if not verifications:
            return make_response(True, "No deleted verifications found",result={"count": 0, "items": []}, status=404)

        return make_response(False, "Deleted verifications fetched successfully", result={"count": len(verifications), "items": verifications})
    except Exception as e:
        return make_response(True, f"Error fetching deleted verifications: {str(e)}", result={"count": 0, "items": []},status=500)
