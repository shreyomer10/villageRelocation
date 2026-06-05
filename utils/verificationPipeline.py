import requests
from google import genai
from datetime import timedelta
import math

from utils.helpers import nowIST, parse_ist
from config import GEMINI_API, GEMINI_MODEL


# ---------------- GEMINI SETUP ----------------


client = genai.Client(api_key=GEMINI_API
)


# ---------------- HAVERSINE DISTANCE ----------------

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Returns distance between two coordinates in meters
    """

    R = 6371000  # Earth radius in meters

    lat1 = math.radians(lat1)
    lon1 = math.radians(lon1)
    lat2 = math.radians(lat2)
    lon2 = math.radians(lon2)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


# ---------------- GEO VALIDATION ----------------

def validate_geo(photo_lat, photo_lon, plot_lat, plot_lon):

    try:

        distance = haversine_distance(
            photo_lat,
            photo_lon,
            plot_lat,
            plot_lon
        )

        return distance <= 50

    except:
        return False


# ---------------- TIME VALIDATION ----------------

def validate_time(captured_time_str):

    try:

        now_str = nowIST()

        now = parse_ist(now_str)
        captured = parse_ist(captured_time_str)

        diff = abs(now - captured)

        return diff < timedelta(hours=24)

    except:
        return False


# ---------------- STAGE CLASSIFICATION ----------------

def classify_stage(image_url, stage_map):

    try:

        image_bytes = requests.get(image_url, timeout=10).content

        stage_text = "\n".join(
            [
                f"{stage_id} | {stage['name']} | {stage['desc']}"
                for stage_id, stage in stage_map.items()
            ]
        )

        stage_ids = list(stage_map.keys())

        prompt = f"""
You are performing STRICT classification of a construction stage.

You MUST return ONLY one stageId from the allowed list.

Allowed stages:

{stage_text}

Rules:
- Output MUST be ONLY a stageId
- Output MUST exactly match one of these stageIds
- Do NOT output stage name
- Do NOT output explanation
- Do NOT output punctuation
- Do NOT output sentences
- If uncertain return: UNKNOWN

Allowed stageIds:
{", ".join(stage_ids)}

Output format:
<stageId>
"""

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                prompt,
                {"mime_type": "image/jpeg", "data": image_bytes}
            ]
        )

        return response.text.strip()

    except:
        return None

# ---------------- STAGE VALIDATION ----------------
def validate_stage(docs, submitted_stage, stage_map):

    if not docs:
        return False

    predicted_stage = classify_stage(docs[0], stage_map)

    if not predicted_stage:
        return False

    return predicted_stage == submitted_stage

# ---------------- MAIN PIPELINE ----------------

def run_verification_pipeline(verification, plot, stage_map):

    geo_result = validate_geo(
        verification["latitude"],
        verification["longitude"],
        plot["latitude"],
        plot["longitude"]
    )

    time_result = validate_time(
        verification["capturedAt"]
    )

    stage_result = validate_stage(
        verification.get("docs", []),
        verification["currentStage"],
        stage_map
    )

    fraud_score = (
        (0 if geo_result else 1) +
        (0 if time_result else 1) +
        (0 if stage_result else 1)
    )

    return {
        "geoFlag": geo_result,
        "timeFlag": time_result,
        "stageFlag": stage_result,
        "fraudScore": fraud_score,
        "flag": fraud_score > 0
    }