
import datetime as dt

from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import  ASCENDING, DESCENDING
from config import db
import jwt
from helpers import hash_password,verify_password,to_village_card
from tokenAuth import auth_required,make_jwt


app = Flask(__name__)
CORS(app,
     supports_credentials=True,
     resources={
         r"/*": {
             "origins": [
                 "http://localhost:5173",
                 "https://villagerelocation-kkot.onrender.com"
             ]
         }
     })




users = db.users
villages = db.villages
stages = db.stages
village_stage_progress = db.village_stage_progress
families = db.families
family_members = db.family_members
option1_housing = db.option1_housing
option2_fundflow = db.option2_fundflow
plan_layouts = db.plan_layouts


# ----------------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------------

@app.route("/",methods=["GET"])
def home():
    return "ok"

@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = users.find_one({"email": email})
    if not user or not verify_password(password, user.get("password_hash", b"")):
        return jsonify({"error": "Invalid credentials"}), 401
    token = make_jwt({"sub": str(user.get("_id")), "role": user.get("role"), "name": user.get("name")})
    return jsonify({
        "token": token,
        "user": {"name": user.get("name"), "email": user.get("email"), "role": user.get("role")}
    })




@app.route("/villages", methods=["GET"])
def get_all_villages():
    """Dashboard list with optional stage filter (?stage=3 or ?stage=2,3)."""
    stage = request.args.get("stage")
    q = {}
    if stage:
        try:
            # allow comma-separated list
            stages_filter = [int(s.strip()) for s in stage.split(",") if s.strip().isdigit()]
            if stages_filter:
                q["current_stage"] = {"$in": stages_filter}
        except Exception:
            pass
    cursor = villages.find(q, projection={"_id": 0, "village_id": 1, "name": 1, "current_stage": 1, "updated_at": 1}).sort("name", ASCENDING)
    return jsonify([to_village_card(v) for v in cursor])


@app.route("/villages/<village_id>/family-count", methods=["GET"])
def get_family_count(village_id):
    pipeline = [
        {"$match": {"village_id": village_id}},
        {"$group": {
            "_id": "$relocation_option",
            "count": {"$sum": 1}
        }}
    ]
    counts = {"total": 0, "option1": 0, "option2": 0}
    for row in families.aggregate(pipeline):
        counts["total"] += row["count"]
        if row["_id"] == 1 or row["_id"] == "1" or row["_id"] == "Option1":
            counts["option1"] = row["count"]
        elif row["_id"] == 2 or row["_id"] == "2" or row["_id"] == "Option2":
            counts["option2"] = row["count"]
    return jsonify({
        "villageId": village_id,
        "totalFamilies": counts["total"],
        "familiesOption1": counts["option1"],
        "familiesOption2": counts["option2"],
    })


@app.route("/villages/<village_id>", methods=["GET"])
def get_village_data(village_id):
    v = villages.find_one({"village_id": village_id}, {"_id": 0})
    if not v:
        return jsonify({"error": "Village not found"}), 404

    # Compute total stages from stages collection if not set
    total_stages = v.get("total_stages")
    if not total_stages:
        total_stages = stages.count_documents({})

    data = {
        "villageId": v.get("village_id"),
        "name": v.get("name"),
        "currentStage": v.get("current_stage"),
        "totalStages": total_stages,
        "lastUpdatedOn": v.get("updated_at"),
        "location": {
            "latitude": v.get("location_latitude"),
            "longitude": v.get("location_longitude"),
        },
        "areaOfRelocation": v.get("area_of_relocation"),
        "areaDiverted": v.get("area_diverted"),
        "image": v.get("photo"),
    }
    return jsonify(data)


@app.route("/villages/<village_id>/beneficiaries", methods=["GET"])
def get_beneficiaries(village_id):
    option = request.args.get("option")  # '1' or '2'
    q = {"village_id": village_id}
    if option in {"1", "2"}:
        # support numeric or string storage
        q["relocation_option"] = int(option)
    projection = {
        "_id": 0,
        "family_id": 1,
        "mukhiyaName": 1,
        "mukhiya_photo": 1,
    }
    cursor = families.find(q, projection=projection).sort("mukhiyaName", ASCENDING)
    results = [{
        "familyId": f.get("family_id"),
        "mukhiyaName": f.get("mukhiyaName"),
        "mukhiyaPhoto": f.get("mukhiya_photo"),
    } for f in cursor]
    return jsonify(results)


@app.route("/families/<family_id>", methods=["GET"])
def get_family_data(family_id):
    f = families.find_one({"family_id": family_id}, {"_id": 0})
    if not f:
        return jsonify({"error": "Family not found"}), 404

    members = list(family_members.find({"family_id": family_id}, {"_id": 0}))

    # Option1 and Option2 progress (if any)
    o1_photos = list(option1_housing.find({"family_id": family_id}, {"_id": 0}).sort("uploaded_on", DESCENDING))
    o2_progress = list(option2_fundflow.find({"family_id": family_id}, {"_id": 0}).sort("transaction_date", DESCENDING))

    return jsonify({
        "family": {
            "familyId": f.get("family_id"),
            "villageId": f.get("village_id"),
            "mukhiyaId": f.get("mukhiyaId"),
            "mukhiyaName": f.get("mukhiyaName"),
            "mukhiyaPhoto": f.get("mukhiya_photo"),
            "relocationOption": f.get("relocation_option"),
            "createdAt": f.get("created_at"),
            "updatedAt": f.get("updated_at"),
        },
        "members": members,
        "option1Housing": o1_photos,
        "option2FundFlow": o2_progress,
    })


# ----------------------------------------------------------------------------
# Bootstrap utility: create an initial admin and sample data (optional)
# ----------------------------------------------------------------------------
@app.route("/dev/bootstrap", methods=["POST"])
def bootstrap_seed():
    # """Seed minimal sample data. Protect/remove in production!"""
    # if os.getenv("FLASK_ENV") != "development":
    #     return jsonify({"error": "Not allowed in production"}), 403

    # Idempotent inserts
    users.update_one(
        {"email": "admin@example.com"},
        {"$setOnInsert": {
            "name": "Admin User",
            "email": "admin@example.com",
            "role": "Admin",
            "password_hash": hash_password("Admin@123")
        }},
        upsert=True,
    )

    # Stages (example 5)
    stage_defs = [
        {"stage_id": 1, "name": "Gram Sabha Meeting", "description": "Initial consent", "sequence_no": 1},
        {"stage_id": 2, "name": "Consent Collection", "description": "Collect family consent", "sequence_no": 2},
        {"stage_id": 3, "name": "Land Identification", "description": "Identify land", "sequence_no": 3},
        {"stage_id": 4, "name": "Compensation Approval", "description": "Approve funds", "sequence_no": 4},
        {"stage_id": 5, "name": "Relocation Completed", "description": "Handover", "sequence_no": 5},
    ]
    for s in stage_defs:
        stages.update_one({"stage_id": s["stage_id"]}, {"$setOnInsert": s}, upsert=True)

    # Village sample
    v = {
        "village_id": "TILAIDABRA",
        "name": "Tilaidabra",
        "current_stage": 2,
        "total_stages": 5,
        "location_latitude": 20.123456,
        "location_longitude": 81.234567,
        "area_of_relocation": 150.5,
        "area_diverted": 120.0,
        "photo": "https://example.com/images/tila.jpg",
        "created_at": dt.datetime.utcnow(),
        "updated_at": dt.datetime.utcnow(),
    }
    villages.update_one({"village_id": v["village_id"]}, {"$set": v}, upsert=True)

    # Families
    fam1 = {
        "family_id": "FAM-001",
        "village_id": "TILAIDABRA",
        "mukhiyaId": "A1234",
        "mukhiyaName": "Ramesh Kumar",
        "mukhiya_photo": "https://example.com/families/fam001.jpg",
        "relocation_option": 1,
        "created_at": dt.datetime.utcnow(),
        "updated_at": dt.datetime.utcnow(),
    }
    fam2 = {
        "family_id": "FAM-002",
        "village_id": "TILAIDABRA",
        "mukhiyaId": "B9876",
        "mukhiyaName": "Sita Devi",
        "mukhiya_photo": "https://example.com/families/fam002.jpg",
        "relocation_option": 2,
        "created_at": dt.datetime.utcnow(),
        "updated_at": dt.datetime.utcnow(),
    }
    families.update_one({"family_id": fam1["family_id"]}, {"$set": fam1}, upsert=True)
    families.update_one({"family_id": fam2["family_id"]}, {"$set": fam2}, upsert=True)

    # Family members
    family_members.update_one({"member_id": "M-001-1"}, {"$set": {
        "member_id": "M-001-1", "family_id": "FAM-001", "name": "Ramesh Kumar", "age": 42, "health_status": "Good", "photo": "https://example.com/members/m0011.jpg"
    }}, upsert=True)
    family_members.update_one({"member_id": "M-001-2"}, {"$set": {
        "member_id": "M-001-2", "family_id": "FAM-001", "name": "Sunita Kumari", "age": 39, "health_status": "Good", "photo": "https://example.com/members/m0012.jpg"
    }}, upsert=True)

    family_members.update_one({"member_id": "M-002-1"}, {"$set": {
        "member_id": "M-002-1", "family_id": "FAM-002", "name": "Sita Devi", "age": 45, "health_status": "Diabetic", "photo": "https://example.com/members/m0021.jpg"
    }}, upsert=True)

    # Option1 housing photos
    option1_housing.update_one({"id": "O1-001-1"}, {"$set": {
        "id": "O1-001-1", "family_id": "FAM-001", "geo_lat": 20.1235, "geo_long": 81.2346, "photo_url": "https://example.com/o1/fam001_1.jpg", "progress_note": "Foundation complete", "uploaded_on": dt.datetime.utcnow()
    }}, upsert=True)

    # Option2 fund flow stages
    o2_items = [
        {"id": "O2-002-1", "family_id": "FAM-002", "stage": "Allocated to Collector", "amount": 1500000, "status": "Completed", "transaction_date": dt.datetime.utcnow(), "proof_document": "https://example.com/docs/alloc.pdf"},
        {"id": "O2-002-2", "family_id": "FAM-002", "stage": "Collector + Beneficiary Joint Account", "amount": 0, "status": "Completed", "transaction_date": dt.datetime.utcnow(), "proof_document": "https://example.com/docs/joint.pdf"},
        {"id": "O2-002-3", "family_id": "FAM-002", "stage": "Disbursed Stage 1 (5L)", "amount": 500000, "status": "Completed", "transaction_date": dt.datetime.utcnow(), "proof_document": "https://example.com/docs/stage1.pdf"},
        {"id": "O2-002-4", "family_id": "FAM-002", "stage": "Disbursed Stage 2 (4.5L)", "amount": 450000, "status": "Pending", "transaction_date": None, "proof_document": None},
        {"id": "O2-002-5", "family_id": "FAM-002", "stage": "Disbursed Stage 3 (5.5L)", "amount": 550000, "status": "Pending", "transaction_date": None, "proof_document": None},
    ]
    for it in o2_items:
        option2_fundflow.update_one({"id": it["id"]}, {"$set": it}, upsert=True)

    return jsonify({"ok": True})



if __name__ == "__main__":
    app.run(debug=True)

