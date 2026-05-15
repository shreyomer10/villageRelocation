"""
Seed every allowed collection with 50 documents distributed across 50 villages.

Ground truth for fields/types is `routes/ai_agent/schema.py`. This script will
not invent fields outside that schema; the only collection in
ALLOWED_COLLECTIONS without an explicit description (plotUpdates) is modelled
on the materialUpdates/facilityUpdates shape (same updates pattern).

Run from inside villageRelocation/:

    python scripts/seed_data.py            # insert (errors if non-empty)
    python scripts/seed_data.py --drop     # drop all allowed collections first
    python scripts/seed_data.py --append   # ignore existing, just insert
"""

import argparse
import os
import random
import sys
import time
from datetime import datetime, timedelta

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import AutoReconnect, NetworkTimeout, ServerSelectionTimeoutError

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
if PARENT not in sys.path:
    sys.path.insert(0, PARENT)

from routes.ai_agent.schema import ALLOWED_COLLECTIONS

random.seed(42)

# Standalone client with generous timeouts so a flaky link doesn't kill the
# seed mid-run. Not using `from config import db` because we don't want to
# change timeouts for the running app.
load_dotenv(os.path.join(PARENT, ".env"))
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
if not MONGO_URI or not DB_NAME:
    raise SystemExit("MONGO_URI / DB_NAME missing from .env")

client = MongoClient(
    MONGO_URI,
    tls=True,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=60000,
    connectTimeoutMS=60000,
    socketTimeoutMS=120000,
    retryWrites=True,
    retryReads=True,
)
db = client[DB_NAME]

_TRANSIENT = (AutoReconnect, NetworkTimeout, ServerSelectionTimeoutError)


def _retry(label, fn, *args, attempts=6, **kwargs):
    """Run a Mongo call with exponential backoff on transient network errors."""
    delay = 2
    for i in range(1, attempts + 1):
        try:
            return fn(*args, **kwargs)
        except _TRANSIENT as e:
            if i == attempts:
                raise
            print(f"  [{label}] attempt {i}/{attempts} failed ({type(e).__name__}); retrying in {delay}s")
            time.sleep(delay)
            delay = min(delay * 2, 30)

N = 50

DISTRICTS = [
    "Raipur", "Bilaspur", "Durg", "Dhamtari", "Korba",
    "Bastar", "Kanker", "Mahasamund", "Surguja", "Jashpur",
]
JANPADS = [
    "Arang", "Abhanpur", "Tilda", "Kasdol", "Bhatapara",
    "Pendra", "Masturi", "Kota", "Lormi", "Takhatpur",
]
TEHSILS = [
    "Tilda", "Arang", "Dharsiwa", "Abhanpur", "Gariaband",
    "Mungeli", "Bilha", "Kota", "Pendra Road", "Marwahi",
]
GRAM_PANCHAYATS = [
    "Kurud", "Mandhar", "Patan", "Pithora", "Saraipali",
    "Basna", "Bagbahara", "Tumgaon", "Bemetara", "Berla",
]
VILLAGE_NAMES = [
    "Khairagarh", "Salhewara", "Tendukona", "Bilaigarh", "Pithora",
    "Gariaband", "Mainpur", "Devbhog", "Chhura", "Fingeshwar",
    "Saraipali", "Basna", "Pamgarh", "Akaltara", "Janjgir",
    "Champa", "Sakti", "Korba", "Katghora", "Pali",
    "Dharamjaigarh", "Pathalgaon", "Bagicha", "Kunkuri", "Manora",
    "Lailunga", "Sarangarh", "Baramkela", "Pussore", "Kharsia",
    "Raigarh", "Tamnar", "Gharghoda", "Dharsiwa", "Tilda",
    "Arang", "Abhanpur", "Mandir Hasaud", "Kasdol", "Bhatapara",
    "Lormi", "Mungeli", "Takhatpur", "Kota", "Pendra",
    "Marwahi", "Pratappur", "Wadrafnagar", "Ramanujganj", "Ambikapur",
]
RANGES = ["Range_A", "Range_B", "Range_C", "Range_D", "Range_E"]
CIRCLES = ["Circle_1", "Circle_2", "Circle_3", "Circle_4", "Circle_5"]
BEATS = ["Beat_1", "Beat_2", "Beat_3", "Beat_4", "Beat_5"]

MALE_NAMES = [
    "Ramesh", "Suresh", "Mahesh", "Dinesh", "Rajesh",
    "Mukesh", "Bhupesh", "Hitesh", "Naresh", "Brijesh",
    "Mohan", "Sohan", "Rohan", "Kishan", "Lakhan",
    "Govind", "Ravinder", "Surinder", "Manohar", "Devendra",
    "Shankar", "Prakash", "Vinod", "Pramod", "Sunil",
]
FEMALE_NAMES = [
    "Sita", "Gita", "Rita", "Meena", "Leela",
    "Kamla", "Sushila", "Savitri", "Saraswati", "Lakshmi",
    "Radha", "Janki", "Parvati", "Durga", "Kaushalya",
    "Sunita", "Anita", "Pushpa", "Shanti", "Rama",
]
SURNAMES = [
    "Sahu", "Verma", "Patel", "Yadav", "Sharma",
    "Netam", "Mandavi", "Kashyap", "Markam", "Dhruv",
    "Nag", "Korram", "Baghel", "Sori", "Maravi",
]

GENDERS = ["Male", "Female"]
HEALTH = ["Good", "Fair", "Poor", "Chronic"]
RELOC_OPTIONS = ["Option_1", "Option_2"]
STAGES = ["notStarted", "surveyDone", "plotAllocated", "constructionStarted", "houseBuilt", "completed"]
SUBSTAGES = ["sub_A", "sub_B", "sub_C", "sub_D"]

BUILDING_TYPES = ["school", "panchayatBhawan", "anganwadi", "communityHall", "healthCentre"]
FACILITY_NAMES = ["Hand Pump", "Bore Well", "Solar Light", "Power Line", "Approach Road", "Drainage", "Toilet Block"]
MATERIAL_NAMES = ["Cement", "Sand", "Bricks", "Steel Bars", "Gravel", "Wood", "Roofing Sheet", "Paint", "Pipes", "Wire"]
MATERIAL_UNITS = ["bag", "ton", "piece", "kg", "litre", "metre"]
MATERIAL_TYPES = ["request", "delivery", "consumption"]

ROLES = ["admin", "surveyor", "engineer", "supervisor", "verifier"]

# ----------------------------------------------------------------------------
# helpers

def pick(seq):
    return random.choice(seq)

def pick_n(seq, k_min, k_max):
    k = random.randint(k_min, min(k_max, len(seq)))
    return random.sample(seq, k)

def cg_lat():
    # Chhattisgarh roughly lies in 17.8 - 24.1 N
    return round(random.uniform(17.8, 24.1), 6)

def cg_lng():
    # 80.2 - 84.4 E
    return round(random.uniform(80.2, 84.4), 6)

def iso_recent(days_back_max=400):
    dt = datetime(2026, 5, 15) - timedelta(
        days=random.randint(0, days_back_max),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
    )
    return dt.strftime("%Y-%m-%dT%H:%M:%S")

def male_name():
    return f"{pick(MALE_NAMES)} {pick(SURNAMES)}"

def female_name():
    return f"{pick(FEMALE_NAMES)} {pick(SURNAMES)}"

def person_name(gender):
    return female_name() if gender == "Female" else male_name()

def doc_urls(n):
    return [f"https://maati-bucket.s3.ap-south-1.amazonaws.com/docs/{random.randint(10000, 99999)}.pdf" for _ in range(n)]

def photo_urls(n):
    return [f"https://maati-bucket.s3.ap-south-1.amazonaws.com/photos/{random.randint(10000, 99999)}.jpg" for _ in range(n)]

# ----------------------------------------------------------------------------
# builders

def build_villages():
    docs = []
    for i in range(N):
        vid = f"VILL_{i+1:03d}"
        completed_count = random.randint(0, len(SUBSTAGES))
        docs.append({
            "villageId": vid,
            "name": VILLAGE_NAMES[i],
            "district": pick(DISTRICTS),
            "janpad": pick(JANPADS),
            "tehsil": pick(TEHSILS),
            "gramPanchayat": pick(GRAM_PANCHAYATS),
            "siteOfRelocation": pick(VILLAGE_NAMES),
            "fd": f"FD_{random.randint(1, 15):02d}",
            "sd": f"SD_{random.randint(1, 30):02d}",
            "range": pick(RANGES),
            "circle": pick(CIRCLES),
            "beat": pick(BEATS),
            "lat": cg_lat(),
            "long": cg_lng(),
            "currentStage": pick(STAGES),
            "currentSubStage": pick(SUBSTAGES),
            "completed_substages": SUBSTAGES[:completed_count],
            "emp": [f"EMP_{random.randint(1, 50):03d}" for _ in range(random.randint(1, 4))],
            "photos": photo_urls(random.randint(0, 3)),
            "docs": doc_urls(random.randint(0, 3)),
            "familyMasterList": f"https://maati-bucket.s3.ap-south-1.amazonaws.com/master/{vid}_families.csv",
            "deleted": random.random() < 0.05,
        })
    return docs


def build_plots(villages):
    docs = []
    for i in range(N):
        v = villages[i % N]
        docs.append({
            "plotId": f"PLOT_{i+1:03d}",
            "name": f"Plot {i+1}",
            "typeId": f"PT_{random.randint(1, 5):02d}",
            "villageId": v["villageId"],
            "latitude": cg_lat(),
            "longitude": cg_lng(),
            "currentStage": pick(STAGES),
            "stagesCompleted": STAGES[:random.randint(0, len(STAGES))],
            "deleted": random.random() < 0.08,
            "docs": doc_urls(random.randint(0, 2)),
            "familyId": f"FAM_{i+1:03d}",  # 1:1 with families
        })
    return docs


def build_families(villages, plots):
    docs = []
    for i in range(N):
        v = villages[i % N]
        p = plots[i]
        gender = pick(GENDERS)
        mukhiya = person_name(gender)
        member_count = random.randint(2, 6)
        members = []
        for _ in range(member_count):
            mg = pick(GENDERS)
            members.append({
                "name": person_name(mg),
                "age": str(random.randint(1, 80)),
                "gender": mg,
                "healthStatus": pick(HEALTH),
                "photo": photo_urls(1)[0],
            })
        docs.append({
            "familyId": f"FAM_{i+1:03d}",
            "mukhiyaName": mukhiya,
            "villageId": v["villageId"],
            "plotId": p["plotId"],
            "relocationOption": pick(RELOC_OPTIONS),
            "mukhiyaAge": str(random.randint(25, 75)),
            "mukhiyaGender": gender,
            "mukhiyaHealth": pick(HEALTH),
            "mukhiyaPhoto": photo_urls(1)[0],
            "lat": cg_lat(),
            "long": cg_lng(),
            "currentStage": pick(STAGES),
            "stagesCompleted": STAGES[:random.randint(0, len(STAGES))],
            "members": members,
            "photos": photo_urls(random.randint(0, 3)),
            "docs": doc_urls(random.randint(0, 3)),
        })
    return docs


def build_houses(villages, plots, families):
    docs = []
    for i in range(N):
        p = plots[i]
        f = families[i]
        num_homes = random.randint(1, 3)
        home_details = []
        for h in range(num_homes):
            home_details.append({
                "homeId": f"HOME_{i+1:03d}_{h+1}",
                "currentStage": pick(STAGES),
                "stagesCompleted": STAGES[:random.randint(0, len(STAGES))],
                "familyId": f["familyId"],
                "mukhiyaName": f["mukhiyaName"],
                "docs": doc_urls(random.randint(0, 2)),
            })
        docs.append({
            "plotId": p["plotId"],
            "villageId": p["villageId"],
            "familyId": f["familyId"],
            "mukhiyaName": f["mukhiyaName"],
            "typeId": f"HT_{random.randint(1, 4):02d}",
            "numberOfHome": num_homes,
            "latitude": cg_lat(),
            "longitude": cg_lng(),
            "deleted": random.random() < 0.05,
            "homeDetails": home_details,
        })
    return docs


def build_buildings(villages):
    docs = []
    for i in range(N):
        v = villages[i % N]
        stage_count = random.randint(2, 5)
        stages = []
        for s in range(stage_count):
            stages.append({
                "stageId": f"BSTG_{i+1:03d}_{s+1}",
                "name": pick(STAGES),
                "desc": f"Stage description for building {i+1} step {s+1}",
                "deleted": random.random() < 0.05,
            })
        docs.append({
            "name": f"{pick(BUILDING_TYPES).title()} {i+1}",
            "villageId": v["villageId"],
            "typeId": f"BT_{random.randint(1, 5):02d}",
            "deleted": random.random() < 0.05,
            "stages": stages,
        })
    return docs


def build_facilities(villages):
    docs = []
    for i in range(N):
        v = villages[i % N]
        docs.append({
            "facilityId": f"FAC_{i+1:03d}",
            "villageId": v["villageId"],
            "name": pick(FACILITY_NAMES),
            "deleted": random.random() < 0.05,
        })
    return docs


def build_facility_updates(facilities):
    docs = []
    for i in range(N):
        f = facilities[i % N]
        hist_count = random.randint(1, 3)
        history = []
        for _ in range(hist_count):
            history.append({
                "status": random.randint(0, 2),
                "comments": pick([
                    "Initial inspection done", "Materials short",
                    "Re-verification required", "Approved by supervisor",
                    "Rejected pending docs",
                ]),
                "verifier": f"EMP_{random.randint(1, 50):03d}",
                "time": iso_recent(),
            })
        docs.append({
            "verificationId": f"FUPD_{i+1:03d}",
            "facilityId": f["facilityId"],
            "villageId": f["villageId"],
            "name": f["name"],
            "status": random.randint(0, 2),
            "verifiedAt": iso_recent(),
            "verifiedBy": f"EMP_{random.randint(1, 50):03d}",
            "insertedBy": f"EMP_{random.randint(1, 50):03d}",
            "insertedAt": iso_recent(),
            "notes": pick(["OK", "Needs follow-up", "Pending photos", "Completed"]),
            "docs": doc_urls(random.randint(0, 2)),
            "statusHistory": history,
        })
    return docs


def build_materials():
    docs = []
    for i in range(N):
        name = MATERIAL_NAMES[i % len(MATERIAL_NAMES)]
        docs.append({
            "materialId": f"MAT_{i+1:03d}",
            "name": f"{name} grade-{(i // len(MATERIAL_NAMES)) + 1}",
            "desc": f"Construction material: {name}",
        })
    return docs


def build_material_updates(villages, materials):
    docs = []
    for i in range(N):
        v = villages[i % N]
        m = materials[i % N]
        hist_count = random.randint(1, 3)
        history = []
        for _ in range(hist_count):
            history.append({
                "status": random.randint(0, 2),
                "comments": pick([
                    "Stock received", "Partial delivery",
                    "Quality check pending", "Approved",
                    "Returned to vendor",
                ]),
                "verifier": f"EMP_{random.randint(1, 50):03d}",
                "time": iso_recent(),
            })
        docs.append({
            "updateId": f"MUPD_{i+1:03d}",
            "materialId": m["materialId"],
            "villageId": v["villageId"],
            "type": pick(MATERIAL_TYPES),
            "qty": str(random.randint(5, 500)),
            "unit": pick(MATERIAL_UNITS),
            "status": random.randint(0, 2),
            "verifiedAt": iso_recent(),
            "verifiedBy": f"EMP_{random.randint(1, 50):03d}",
            "insertedBy": f"EMP_{random.randint(1, 50):03d}",
            "insertedAt": iso_recent(),
            "notes": pick(["Verified at gate", "Waiting bill", "Cleared", "Discrepancy logged"]),
            "docs": doc_urls(random.randint(0, 2)),
            "statusHistory": history,
        })
    return docs


def build_plot_updates(plots):
    # Not described in schema.py; modeled on the updates pattern from
    # facilityUpdates / materialUpdates because plotUpdates is in
    # ALLOWED_COLLECTIONS.
    docs = []
    for i in range(N):
        p = plots[i % N]
        hist_count = random.randint(1, 3)
        history = []
        for _ in range(hist_count):
            history.append({
                "status": random.randint(0, 2),
                "comments": pick(["Survey complete", "Layout marked", "Foundation dug", "Disputed boundary"]),
                "verifier": f"EMP_{random.randint(1, 50):03d}",
                "time": iso_recent(),
            })
        docs.append({
            "updateId": f"PUPD_{i+1:03d}",
            "plotId": p["plotId"],
            "villageId": p["villageId"],
            "status": random.randint(0, 2),
            "verifiedAt": iso_recent(),
            "verifiedBy": f"EMP_{random.randint(1, 50):03d}",
            "insertedBy": f"EMP_{random.randint(1, 50):03d}",
            "insertedAt": iso_recent(),
            "notes": pick(["OK", "Pending re-survey", "Marked completed"]),
            "docs": doc_urls(random.randint(0, 2)),
            "statusHistory": history,
        })
    return docs


def build_users(villages):
    docs = []
    for i in range(N):
        gender = pick(GENDERS)
        name = person_name(gender)
        v_count = random.randint(1, 4)
        v_ids = [villages[(i + k) % N]["villageId"] for k in range(v_count)]
        docs.append({
            "userId": f"USR_{i+1:03d}",
            "email": f"user{i+1:03d}@maati.local",
            "name": name,
            "role": pick(ROLES),
            "mobile": f"9{random.randint(100000000, 999999999)}",
            "password": f"hash${random.randint(10**10, 10**11):011d}",
            "verified": random.random() < 0.85,
            "activated": random.random() < 0.9,
            "deleted": random.random() < 0.05,
            "villageID": v_ids,
            "otp": {
                "code": f"{random.randint(0, 999999):06d}",
                "used": random.random() < 0.5,
                "passed": random.random() < 0.7,
                "expiresAt": iso_recent(days_back_max=1),
            },
        })
    return docs


# ----------------------------------------------------------------------------
# main

COLLECTION_BUILDERS = [
    "villages", "plots", "families", "house", "buildings",
    "facilities", "facilityUpdates", "materials", "materialUpdates",
    "plotUpdates", "users",
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--drop", action="store_true", help="drop allowed collections first")
    parser.add_argument("--append", action="store_true", help="insert even if collection has docs")
    args = parser.parse_args()

    unknown = set(COLLECTION_BUILDERS) - ALLOWED_COLLECTIONS
    if unknown:
        raise RuntimeError(f"builder targets a non-allowed collection: {unknown}")

    # warm the pool once so the first failure surfaces here, not mid-loop
    _retry("ping", client.admin.command, "ping")

    if args.drop:
        for name in COLLECTION_BUILDERS:
            _retry(f"drop {name}", db[name].drop)
            print(f"  dropped {name}")

    if not args.append and not args.drop:
        for name in COLLECTION_BUILDERS:
            if _retry(f"count {name}", db[name].estimated_document_count) > 0:
                raise SystemExit(
                    f"refusing to insert: collection '{name}' is not empty. "
                    "re-run with --drop to wipe or --append to add on top."
                )

    villages = build_villages()
    plots = build_plots(villages)
    families = build_families(villages, plots)
    houses = build_houses(villages, plots, families)
    buildings = build_buildings(villages)
    facilities = build_facilities(villages)
    facility_updates = build_facility_updates(facilities)
    materials = build_materials()
    material_updates = build_material_updates(villages, materials)
    plot_updates = build_plot_updates(plots)
    users = build_users(villages)

    payload = {
        "villages": villages,
        "plots": plots,
        "families": families,
        "house": houses,
        "buildings": buildings,
        "facilities": facilities,
        "facilityUpdates": facility_updates,
        "materials": materials,
        "materialUpdates": material_updates,
        "plotUpdates": plot_updates,
        "users": users,
    }

    for name, docs in payload.items():
        result = _retry(f"insert {name}", db[name].insert_many, docs, ordered=False)
        print(f"  inserted {len(result.inserted_ids):>3d} into {name}")

    print(f"\nseed complete: {sum(len(v) for v in payload.values())} documents across {len(payload)} collections")


if __name__ == "__main__":
    main()
