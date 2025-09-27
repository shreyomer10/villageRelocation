from pydantic import BaseModel, Field, HttpUrl, ValidationError, field_validator
from typing import Optional, List




# class StatusHistory(BaseModel):
#     comments:str
#     verifier:str
#     time: str          # ISO timestamp

class VillageUpdatesInsert(BaseModel):
    currentStage:str
    currentSubStage:str
    name:str
    docs:List[str]=Field(default_factory=list)
    notes:str
    class Config:
        extra = "forbid"

class VillageUpdatesUpdate(BaseModel):
    currentStage:Optional[str]=None
    currentSubStage:Optional[str]=None

    name:Optional[str]=None
    docs:Optional[List[str]]=Field(default_factory=list)
    notes:Optional[str]=None
    class Config:
        extra = "forbid"



class VillageUpdates(VillageUpdatesInsert):
    updateId:str                   
    verifiedBy:str
    verifiedAt:str







class SubStageInsert(BaseModel):
    name: str
    desc: Optional[str] = None
    deleted:bool=False
    position: Optional[int] = None  # ✅ new: position index

    class Config:
        extra = "forbid"   # ❌ reject unknown fields
   
    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Stage name cannot be empty if provided")
        return v

    

class SubStageUpdate(BaseModel):
    name: Optional[str]
    desc: Optional[str] = None
    deleted:bool=False
    position: Optional[int] = None  # ✅ new: position index

    class Config:
        extra = "forbid"   # ❌ reject unknown fields

    

class SubStage(SubStageInsert):
    subStageId:str

class StageInsert(BaseModel):
    name: str
    desc: Optional[str] = None
    stages: List[SubStageInsert]= Field(default_factory=list)
    deleted:bool=False
    position: Optional[int] = None  # ✅ new: position index

    class Config:
        extra = "forbid"   # ❌ reject unknown fields

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Stage name cannot be empty if provided")
        return v


class StageUpdate(BaseModel):
    name: Optional[str]
    desc: Optional[str] = None
    deleted:bool=False
    position: Optional[int] = None  # ✅ new: position index

    class Config:
        extra = "forbid"   # ❌ reject unknown fields
    

class Stages(StageInsert):
    stageId:str


class VillageCard(BaseModel):
    villageId: str
    name: str
    currentStage: int
    currentSubStage:int
    updatedAt: str 
    updatedBy:str
    siteOfRelocation:str
    areaDiverted:str
    lat:float
    long:float

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)



class VillageLog(BaseModel):
    type:str #new        meeting / family stage/community facility / family house
    updateTime: str
    updateBy: str
    comments: Optional[str] = None
class Documents(BaseModel):
    name:str
    url:str
    currentStage:Optional[str]=None
    currentSubStage:Optional[str]=None
    notes:Optional[str]=None
    

class Village(BaseModel):
    villageId: str
    name: str
    siteOfRelocation: str
    range: str
    sd1: str
    fd: str
    gramPanchayat: str
    tehsil: str
    janpad: str
    subD2: str
    district: str
    lat: float
    long: float
    kme: str

    docs: List[Documents] = []
    photos: List[str] = []
    logs: List[VillageLog] = []
    familyMasterList:str


    currentStage:str
    currentSubStage: str

    updates:List[VillageUpdates]= Field(default_factory=list)
    completed_substages:List[str]=Field(default_factory=list)

    # Example: ensure latitude/longitude look like numbers
    @field_validator("lat", "long")
    @classmethod
    def validate_coordinates(cls, v: str) -> str:
        try:
            float(v)
        except ValueError:
            raise ValueError("Latitude/Longitude must be numeric strings")
        return v

    # Function to validate a Mongo doc against this model
    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)



class FamilyCount(BaseModel):
    villageId: str
    totalFamilies: int
    familiesOption1: int
    familiesOption2: int

    @classmethod
    def from_counts(cls, village_id: str, counts: dict):
        return cls(
            villageId=village_id,
            totalFamilies=counts.get("total", 0),
            familiesOption1=counts.get("option1", 0),
            familiesOption2=counts.get("option2", 0),
        )