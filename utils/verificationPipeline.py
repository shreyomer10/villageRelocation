import requests
import google.generativeai as genai
from datetime import timedelta
import math

from utils.helpers import nowIST, parse_ist
from config import GEMINI_API, GEMINI_MODEL


# ---------------- GEMINI SETUP ----------------

genai.configure(api_key=GEMINI_API)
model = genai.GenerativeModel(GEMINI_MODEL)


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

def classify_stage(image_url, stages):

    try:

        image_bytes = requests.get(image_url, timeout=10).content

        stage_list = "\n".join(stages)

        prompt = f"""
        You are performing a strict classification task.

        The image shows a construction site. Your task is to determine the stage of construction.

        You MUST choose exactly ONE stage from the list below.

        Allowed stages:
        {stage_list}

        Rules:
        - Return ONLY one stage name.
        - The output MUST exactly match one of the stage names above.
        - Do NOT explain your answer.
        - Do NOT add punctuation, sentences, or extra words.
        - If the stage cannot be determined confidently, return: UNKNOWN

        Output format:
        <stage_name>
        """

        response = model.generate_content(
            [
                prompt,
                {"mime_type": "image/jpeg", "data": image_bytes}
            ]
        )

        return response.text.strip().lower()

    except:
        return None


# ---------------- STAGE VALIDATION ----------------

def validate_stage(docs, submitted_stage, stages):

    if not docs:
        return False

    predicted_stage = classify_stage(docs[0], stages)

    if not predicted_stage:
        return False

    return predicted_stage == submitted_stage.lower()


# ---------------- MAIN PIPELINE ----------------

def run_verification_pipeline(verification, plot, stages):

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
        stages
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