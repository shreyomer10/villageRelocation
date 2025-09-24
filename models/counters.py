from pymongo import ReturnDocument




def get_next_user_id(db):
    counter = db.counters.find_one_and_update(
        {"_id": f"UID"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"UID_{counter['seq']}"



def get_next_meeting_id(db, villageId: str):
    counter = db.counters.find_one_and_update(
        {"_id": f"meeting_{villageId}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"{villageId}_m{counter['seq']}"


def get_next_family_id(db, villageId: str) -> str:
    """
    Generate a unique family ID per village using a counter.

    Format: fam<villageId><seq>
    Example: famRampur1, famRampur2, ...
    """
    counter = db.counters.find_one_and_update(
        {"_id": f"family_{villageId}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"fam_{villageId}_{counter['seq']}"




def get_next_plot_id(db, villageId: str) -> str:
    """
    Generate a unique plot ID per village using a counter.

    Format: plot_<villageId>_<seq>
    Example: plot_Rampur_1, plot_Rampur_2, ...
    """
    counter = db.counters.find_one_and_update(
        {"_id": f"plot_{villageId}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"plot_{villageId}_{counter['seq']}"


def get_next_building_type_id(db, villageId: str) -> str:
    """
    Generate a unique building type ID per village.

    Format: btype_<villageId>_<seq>
    """
    counter = db.counters.find_one_and_update(
        {"_id": f"btype_{villageId}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"btype_{villageId}_{counter['seq']}"

def get_next_stage_id(db, buildingTypeId: str) -> str:
    """
    Generate a unique stage ID per building type.

    Format: stage_<buildingTypeId>_<seq>
    """
    counter = db.counters.find_one_and_update(
        {"_id": f"stage_{buildingTypeId}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"stage_{buildingTypeId}_{counter['seq']}"
def get_next_plot_id(db, villageId: str, typeId: str) -> str:
    """
    Generate a unique plot ID per village and type.

    Format: P_<villageId>_<typeId>_<seq>
    """
    counter = db.counters.find_one_and_update(
        {"_id": f"plot_{villageId}_{typeId}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"P_{villageId}_{typeId}_{counter['seq']}"
def get_next_verification_id(db, villageId: str, typeId: str) -> str:
    """
    Generate a unique verification ID per village and type.

    Format: V_<villageId>_<typeId>_<seq>
    """
    counter = db.counters.find_one_and_update(
        {"_id": f"verification_{villageId}_{typeId}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"V_{villageId}_{typeId}_{counter['seq']}"

def get_next_option_id(db) -> str:

    counter = db.counters.find_one_and_update(
        {"_id": f"options_maati"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"Option_{counter['seq']}"

def get_next_option_stage_id(db,optionId:str) -> str:

    counter = db.counters.find_one_and_update(
        {"_id": f"option_{optionId}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"{optionId}_{counter['seq']}"

def get_next_villageStage_id(db) -> str:

    counter = db.counters.find_one_and_update(
        {"_id": f"stages_maati"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"Stage_{counter['seq']}"

def get_next_villageSubStage_id(db,stageId:str) -> str:

    counter = db.counters.find_one_and_update(
        {"_id": f"sub_{stageId}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"{stageId}_{counter['seq']}"
def get_next_family_update_id(db, villageId: str, optionId: str) -> str:
    """
    Generate a unique ID with a given prefix, per village and option.
      verification of family
    Format: <prefix>_<villageId>_<optionId>_<seq>
    Example: V_101_OP12_3
    """
    counter = db.counters.find_one_and_update(
        {"_id": f"VOF_{villageId}_{optionId}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"VOF_{villageId}_{optionId}_{counter['seq']}"

def get_next_member_update_id(db, familyId: str, optionId: str) -> str:

    counter = db.counters.find_one_and_update(
        {"_id": f"VOM_{familyId}_{optionId}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"VOM_{familyId}_{optionId}_{counter['seq']}"


def get_next_villageStageUpdate_id(db, villageId: str) -> str:
    """
    Generate a unique verification ID per village and type.

    Format: V_<villageId>_<typeId>_<seq>
    """
    counter = db.counters.find_one_and_update(
        {"_id": f"Updates_{villageId}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"Updates_{villageId}_{counter['seq']}"
