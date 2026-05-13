from config import db

_villages = db.villages
_families = db.testing      # actual families collection is named 'testing'
_plots    = db.plots
_houses   = db.house


def get_village_overview():
    """
    Returns every non-deleted village with its family count and current
    relocation stage.  Good for high-level dashboards.
    """
    docs = list(_villages.find(
        {"delete": False},
        {"_id": 0, "villageId": 1, "name": 1, "district": 1, "currentStage": 1}
    ))
    result = []
    for v in docs:
        fam_count = _families.count_documents({"villageId": v["villageId"]})
        result.append({
            "villageId":    v["villageId"],
            "name":         v.get("name", "Unknown"),
            "district":     v.get("district", ""),
            "currentStage": v.get("currentStage") or "Not Started",
            "familyCount":  fam_count,
        })
    return result


def get_family_relocation_stats(village_id=None):
    """
    Returns family distribution split by relocation option (Option_1 / Option_2)
    and by current process stage.  Pass village_id to scope to one village or
    omit to get system-wide stats.
    """
    match = {}
    if village_id:
        match["villageId"] = village_id

    option_agg = list(_families.aggregate([
        {"$match": match},
        {"$group": {"_id": "$relocationOption", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))
    stage_agg = list(_families.aggregate([
        {"$match": match},
        {"$group": {"_id": "$currentStage", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))

    return {
        "scope":              village_id or "All Villages",
        "total":              _families.count_documents(match),
        "byRelocationOption": [
            {"option": r["_id"] or "Unassigned", "count": r["count"]}
            for r in option_agg
        ],
        "byCurrentStage": [
            {"stage": r["_id"] or "INIT", "count": r["count"]}
            for r in stage_agg
        ],
    }


def get_construction_progress(village_id=None):
    """
    Returns how many plots and individual house units sit at each construction
    stage.  Pass village_id to scope to one village.
    """
    match = {"deleted": False}
    if village_id:
        match["villageId"] = village_id

    plot_agg = list(_plots.aggregate([
        {"$match": match},
        {"$group": {"_id": "$currentStage", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))
    house_agg = list(_houses.aggregate([
        {"$match": match},
        {"$unwind": "$homeDetails"},
        {"$group": {"_id": "$homeDetails.currentStage", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))

    return {
        "scope":        village_id or "All Villages",
        "totalPlots":   _plots.count_documents(match),
        "totalHouses":  _houses.count_documents(match),
        "plotsByStage": [
            {"stage": r["_id"] or "Not Started", "count": r["count"]}
            for r in plot_agg
        ],
        "housesByStage": [
            {"stage": r["_id"] or "Not Started", "count": r["count"]}
            for r in house_agg
        ],
    }


TOOLS_MAP = {
    "get_village_overview":        get_village_overview,
    "get_family_relocation_stats": get_family_relocation_stats,
    "get_construction_progress":   get_construction_progress,
}
