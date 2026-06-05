import json
import os
import sys
from datetime import datetime

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

try:
    from google import genai
except ModuleNotFoundError as exc:
    raise ModuleNotFoundError(
        "Missing dependency 'google-genai'. Install it with: pip install -r requirements.txt"
    ) from exc

from config import GEMINI_API, GEMINI_MODEL, db
from routes.ai_agent.executor import run_conversation

SELECTED_PROMPTS = [
    "How many villages are in the system?",
    "Show me villages in the \"Bilaspur\" district.",
    "Which villages belong to the \"Bhanupratappur\" forest division (fd)?",
    "Pie chart of villages by district.",
    "How many families are registered overall?",
    "Show family distribution by relocationOption (pie chart).",
    "How many families chose Option_1 vs Option_2?",
    "Average mukhiyaAge across all families.",
    "How many active (non-deleted) plots are there?",
    "How many plots are soft-deleted?",
    "Total number of homes (sum of numberOfHome) across all houses.",
    "How many users are in each role? (table)",
    "List all surveyors with their names and emails.",
    "How many materials are in the master list?",
    "For each district, how many families are registered? (bar chart)",
    "Which 5 villages have the most families?",
    "How many plots have a corresponding house entry vs. plots with no construction yet?",
    "Which villages have NO users assigned in their emp[] list?",
    "Find families whose villageId does not match any village in the villages collection.",
    "How many buildings of each typeId exist per village? (table)",
    "How many villages are in district 'NonexistentDistrict'?",
    "Bar chart of family count per district.",
    "List users assigned to more than one village (villageID array length > 1).",
    "Standard deviation of family size per district. Highlight districts above the overall mean standard deviation.",
    "Rank villages by a composite score: 0.4 x plot completion % + 0.3 x facility verification % + 0.3 × material delivery %. Return top 10 with each component.",
    "Across all houses, percentage of homeDetails entries in each currentStage.",
    "Which districts show the highest preference for Option_1? Return top 5 with: district, total families, % choosing Option_1.",
]

PROMPT_CACHE_COLLECTION = "prompt_cache"


def main():
    if not GEMINI_API:
        raise RuntimeError("GEMINI_API is not configured")

    client = genai.Client(api_key=GEMINI_API)
    model_name = GEMINI_MODEL or "gemini-2.0-flash"
    cache = db[PROMPT_CACHE_COLLECTION]

    for prompt in SELECTED_PROMPTS:
        print(f"Querying prompt: {prompt}")
        final_payload, trace = run_conversation(
            client=client,
            model=model_name,
            history_messages=[],
            user_prompt=prompt,
        )

        doc = {
            "prompt": prompt,
            "final_payload": final_payload,
            "trace": trace,
            "model": model_name,
            "createdAt": datetime.utcnow().isoformat(),
        }
        cache.replace_one({"prompt": prompt}, doc, upsert=True)
        print(f"Saved cached result for prompt: {prompt}\n")

    print("Prompt cache population complete.")


if __name__ == "__main__":
    main()
