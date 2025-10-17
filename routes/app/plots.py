
import datetime as dt
from flask import Blueprint,request, jsonify
from pydantic import ValidationError
from utils.tokenAuth import auth_required
from models.stages import FieldLevelVerification, FieldLevelVerificationInsert, FieldLevelVerificationUpdate, House, HouseInsert, HouseUpdate, Plots, PlotsInsert, PlotsUpdate, statusHistory
from models.counters import get_next_house_id, get_next_plot_id, get_next_verification_id
from utils.helpers import STATUS_TRANSITIONS, make_response, nowIST, validation_error_response
from config import  db
from pymongo import UpdateOne
from config import client
from pymongo import errors  

houses=db.house
buildings = db.buildings
villages = db.villages
plots = db.plots
families = db.testing

updates=db.plotUpdates

plots_BP= Blueprint("plots",__name__)



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

        # # Check familyId exists (if provided)
        # if plot_obj.familyId:
        #     family_exists = families.find_one({"familyId": plot_obj.familyId})
        #     if not family_exists:
        #         return make_response(True, f"Family with ID {plot_obj.familyId} does not exist", status=404)

        # Generate plotId
        new_plot_id = get_next_plot_id(db, plot_obj.villageId, plot_obj.typeId)


        plot_complete = Plots(
            plotId=new_plot_id,
            stagesCompleted=[],   # auto-populated from docs
            currentStage="",
            **plot_obj.model_dump(exclude_none=True, exclude={"stagesCompleted","docs"})
        )

        # Insert into Mongo
        plot_dict = plot_complete.model_dump(exclude_none=True)
        plots.insert_one(plot_dict)
        plot_dict.pop("_id", None)

        # # If familyId exists, update family with this plotId
        # if plot_obj.familyId:
        #     families.update_one(
        #         {"familyId": plot_obj.familyId},
        #         {"$push": {"plots": new_plot_id}}
        #     )

        return make_response(False, "Plot inserted successfully", result=plot_dict, status=200)

    except Exception as e:
        return make_response(True, f"Error inserting plot: {str(e)}", status=500)


@plots_BP.route("/house/insert", methods=["POST"])
def insert_house():
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)
        try:

            house_obj = HouseInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # Validate villageId and typeId as before
        village_exists = villages.find_one({"villageId": house_obj.villageId})
        if not village_exists:
            return make_response(True, f"Village with ID {house_obj.villageId} does not exist", status=404)

        type_exists = buildings.find_one({
            "typeId": house_obj.typeId,
            "villageId": house_obj.villageId,
            "deleted": False
        })
        if not type_exists:
            return make_response(True, f"Building type with ID {house_obj.typeId} does not exist in this village", status=404)

        # Generate plotId
        new_plot_id = get_next_house_id(db, house_obj.villageId)

        # Assign homeId & stages
        family_ids = [home.familyId for home in house_obj.homeDetails if home.familyId]
        existing_families = list(families.find({"familyId": {"$in": family_ids}}, {"familyId": 1}))
        existing_ids = {f["familyId"] for f in existing_families}
        missing_ids = set(family_ids) - existing_ids

        if missing_ids:
            return make_response(
                True,
                f"These familyIds do not exist: {', '.join(missing_ids)}",
                status=404
            )

        for idx, home in enumerate(house_obj.homeDetails):
            home.homeId = f"{new_plot_id}_H{idx+1}"
            home.currentStage = ""
            home.stagesCompleted = []

        plot_complete = House(
            plotId=new_plot_id,
            **house_obj.model_dump(exclude_none=True, exclude={"stagesCompleted","docs"})
        )

        plot_dict = plot_complete.model_dump(exclude_none=True)
        plot_dict.pop("_id", None)

        # Start transaction
        with client.start_session() as session:
            with session.start_transaction():
                # Insert the house
                houses.insert_one(plot_dict, session=session)

                # Update all families in one bulk operation
                bulk_ops = [
                    UpdateOne(
                        {"familyId": home.familyId},
                        {"$set": {"plotId": new_plot_id}},
                        upsert=False
                    )
                    for home in house_obj.homeDetails
                ]
                if bulk_ops:
                    families.bulk_write(bulk_ops, ordered=True, session=session)
        plot_dict.pop("_id", None)

        return make_response(False, "House inserted successfully", result=plot_dict, status=200)

    except ValidationError as ve:
        return validation_error_response(ve)
    except Exception as e:
        return make_response(True, f"Error inserting house: {str(e)}", status=500)



@plots_BP.route("/plots/<plotId>", methods=["PUT"])
def update_plot(plotId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)


        try:
            update_obj = PlotsUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        plot = plots.find_one({"plotId": plotId, "deleted": False})
        if not plot:
            return make_response(True, "Plot not found", status=404)

        # Validate typeId and villageId if provided
        if update_obj.typeId:
            type_exists = buildings.find_one({
                "typeId": update_obj.typeId or plot["typeId"],
                "villageId": update_obj.villageId or plot["villageId"],
                "deleted": False
            })
            if not type_exists:
                return make_response(True, "Invalid typeId or villageId", status=404)
            update_dict["stagesCompleted"] = []
            update_dict["currentStage"] = ""
        # ✅ Only update fields actually present in request
        update_dict = update_obj.model_dump(
            exclude_unset=True,   # <-- important
            exclude_none=True,
            exclude={"stagesCompleted"}
        )

        if not update_dict:
            return make_response(True, "No valid fields to update", status=400)

        plots.update_one({"plotId": plotId}, {"$set": update_dict})

        return make_response(False, "Plot updated successfully", result=update_dict)

    except Exception as e:
        return make_response(True, f"Error updating plot: {str(e)}", status=500)

@plots_BP.route("/house/<plotId>", methods=["PUT"])
def update_house(plotId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, "Missing request body", status=400)

        try:
            update_obj = HouseUpdate(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        house = houses.find_one({"plotId": plotId, "deleted": False})
        if not house:
            return make_response(True, "House not found", status=404)

        # Prepare update dict only for top-level fields
        update_dict = update_obj.model_dump(
            exclude_unset=True,
            exclude_none=True,
            exclude={"docs", "stagesCompleted", "homeDetails"}
        )

        # Prepare homeDetails updates if provided
        home_updates = update_obj.homeDetails if update_obj.homeDetails else []

        # Check all familyIds exist
        if home_updates:
            family_ids = [h.familyId for h in home_updates]
            existing_families = list(families.find({"familyId": {"$in": family_ids}}, {"familyId": 1}))
            existing_ids = {f["familyId"] for f in existing_families}
            missing_ids = set(family_ids) - existing_ids
            if missing_ids:
                return make_response(
                    True,
                    f"These familyIds do not exist: {', '.join(missing_ids)}",
                    status=404
                )

        with client.start_session() as session:
            with session.start_transaction():
                # Update top-level house fields
                if update_dict:
                    houses.update_one(
                        {"plotId": plotId},
                        {"$set": update_dict},
                        session=session
                    )

                # Update each home individually
                for updated_home in home_updates:
                    family_id = updated_home.familyId
                    # Find the existing home to preserve currentStage, stagesCompleted, and homeId
                    existing_home = next((h for h in house["homeDetails"] if h["familyId"] == family_id), None)
                    if not existing_home:
                        continue  # Should not happen due to familyId check

                    # Merge updated fields, keep other fields intact
                    updated_fields = {
                        "homeDetails.$.mukhiyaName": updated_home.mukhiyaName,
                        "homeDetails.$.familyId": updated_home.familyId,

                    }

                    houses.update_one(
                        {"plotId": plotId, "homeDetails.familyId": family_id},
                        {"$set": updated_fields},
                        session=session
                    )

                    # Update family's plotId if needed
                    families.update_one(
                        {"familyId": family_id},
                        {"$set": {"plotId": plotId}},
                        upsert=False,
                        session=session
                    )

        return make_response(False, "House updated successfully", result=update_dict)

    except ValidationError as ve:
        return validation_error_response(ve)
    except Exception as e:
        return make_response(True, f"Error updating house: {str(e)}", status=500)





@plots_BP.route("/plots/<plotId>", methods=["DELETE"])
def delete_plot(plotId):
    try:
        result = plots.update_one({"plotId": plotId}, {"$set": {"deleted": True}})
        if result.matched_count == 0:
            return make_response(True, "Plot not found", status=404)
        return make_response(False, "Plot deleted successfully")
    except Exception as e:
        return make_response(True, f"Error deleting plot: {str(e)}", status=500)


@plots_BP.route("/house/<plotId>", methods=["DELETE"])
def delete_house(plotId):
    try:
        result = houses.update_one({"plotId": plotId}, {"$set": {"deleted": True}})
        if result.matched_count == 0:
            return make_response(True, "house not found", status=404)
        return make_response(False, "House deleted successfully")
    except Exception as e:
        return make_response(True, f"Error deleting house: {str(e)}", status=500)

@plots_BP.route("/plots/<villageId>", methods=["GET"])
def get_plots(villageId):
    try:
        typeId = request.args.get("typeId")
        query = {"villageId": villageId, "deleted": False}
        if typeId:
            query["typeId"] = typeId

        docs = list(plots.find(query, {"_id": 0}))

        if not docs:
            return make_response(True, "No plots found",result={"count": 0, "items": []}, status=404)

        return make_response(False, "Plots fetched successfully", result={"count": len(docs), "items": docs}, status=200)
    except Exception as e:
        return make_response(True, f"Error fetching plots: {str(e)}",result={"count": 0, "items": []}, status=500)

@plots_BP.route("/house/<villageId>", methods=["GET"])
def get_house(villageId):
    try:
        typeId = request.args.get("typeId")
        query = {"villageId": villageId, "deleted": False}
        if typeId:
            query["typeId"] = typeId

        docs = list(houses.find(query, {"_id": 0}))

        if not docs:
            return make_response(True, "No house found",result={"count": 0, "items": []}, status=404)

        return make_response(False, "house fetched successfully", result={"count": len(docs), "items": docs}, status=200)
    except Exception as e:
        return make_response(True, f"Error fetching plots: {str(e)}",result={"count": 0, "items": []}, status=500)

@plots_BP.route("/plots/<villageId>/<plotId>", methods=["GET"])
def get_plot_complete(villageId,plotId):
    try:
        query = {"villageId": villageId, "deleted": False,"plotId":plotId}

        docs = list(plots.find_one(query, {"_id": 0}))

        if not docs:
            return make_response(True, "Plot not found",result={"count": 0, "items": []}, status=404)

        return make_response(False, "Plot fetched successfully", result={"count": len(docs), "items": docs}, status=200)
    except Exception as e:
        return make_response(True, f"Error fetching plots: {str(e)}",result={"count": 0, "items": []}, status=500)
    

@plots_BP.route("/house/<villageId>/<plotId>", methods=["GET"])
def get_house_complete(villageId,plotId):
    try:
        query = {"villageId": villageId, "deleted": False,"plotId":plotId}

        docs = list(houses.find_one(query, {"_id": 0}))

        if not docs:
            return make_response(True, "house not found",result={"count": 0, "items": []}, status=404)

        return make_response(False, "house fetched successfully", result={"count": len(docs), "items": docs}, status=200)
    except Exception as e:
        return make_response(True, f"Error fetching house: {str(e)}",result={"count": 0, "items": []}, status=500)
    


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


@plots_BP.route("/deleted_house/<villageId>", methods=["GET"])
def get_deleted_houses(villageId):
    try:
        typeId = request.args.get("typeId")
        query = {"villageId": villageId, "deleted": True}
        if typeId:
            query["typeId"] = typeId

        docs = list(houses.find(query, {"_id": 0}))
        if not docs:
            return make_response(True, "No deleted houses found", result={"count": 0, "items": []},status=404)
        return make_response(False, "Deleted houses fetched successfully", result={"count": len(docs), "items": docs}, status=200)
    except Exception as e:
        return make_response(True, f"Error fetching deleted houses: {str(e)}",result={"count": 0, "items": []}, status=500)
