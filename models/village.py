from pydantic import BaseModel, HttpUrl, ValidationError, field_validator
from typing import Optional, List


class SubStage(BaseModel):
    subId: int
    name: str
    desc: Optional[str] = None


class Stage(BaseModel):
    stageId: int
    name: str
    desc: Optional[str] = None
    substages: List[SubStage] = []


class VillageCard(BaseModel):
    villageId: str
    name: str
    currentStage: int
    currentSubStage:int
    updatedAt: str 
    updatedBy:str
    siteOfRelocation:str
    areaDiverted:str

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)
    
from typing import List, Optional


class VillageLog(BaseModel):
    updateTime: str
    updateBy: str
    comments: Optional[str] = None
class Documents(BaseModel):
    name:str
    url:HttpUrl
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
    lat: str
    long: str
    currentStage: str
    currentSubStage: str
    kme: HttpUrl

    docs: List[Documents] = []
    photos: List[HttpUrl] = []
    logs: List[VillageLog] = []
    familyMasterList:HttpUrl

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