from pydantic import BaseModel, Field, HttpUrl, ValidationError, field_validator
from typing import Literal, Optional, List


from utils.helpers import s3_url_pattern


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
    @field_validator("docs")
    @classmethod
    def validate_urls(cls, v: List[str]) -> List[str]:
        if v is []:
            return v
        for url in v:
            # Check for both http/https and s3 schemas
            if not isinstance(url, str) or not (
                url.startswith(("http://", "https://")) or s3_url_pattern.match(url)
            ):
                raise ValueError(f"Invalid URL: {url}")
        return v   

class VillageUpdatesUpdate(BaseModel):
    # currentStage:Optional[str]=None
    # currentSubStage:Optional[str]=None

    name:Optional[str]=None
    docs:Optional[List[str]]=Field(default_factory=list)
    notes:Optional[str]=None
    class Config:
        extra = "forbid"

    @field_validator("docs")
    @classmethod
    def validate_urls(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        for url in v:
            # Check for both http/https and s3 schemas
            if not isinstance(url, str) or not (
                url.startswith(("http://", "https://")) or s3_url_pattern.match(url)
            ):
                raise ValueError(f"Invalid URL: {url}")
        return v


class VillageUpdates(VillageUpdatesInsert):
    updateId:str                   
    verifiedBy:str
    verifiedAt:str
    insertedAt:str








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
    currentStage: str
    currentSubStage:str
    completed_substages:List[str]=None
    updatedAt: str 
    updatedBy:str
    siteOfRelocation:str
    areaDiverted:str
    lat:float
    long:float

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)




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
    fd: str
    sd:str
    range:Optional[str]
    circle:Optional[str]
    beat:Optional[str]
    gramPanchayat: str
    tehsil: str
    janpad: str
    district: str
    lat: float
    long: float
    kml: str
    emp: List[str] = Field(default_factory=list)
    # fdUpdated: str
    # sdUpdated:str
    # rangeUpdated:Optional[str]
    # circleUpdated:Optional[str]
    # beatUpdated:Optional[str]
    # gramPanchayatUpdated: str
    # tehsilUpdated: str
    # janpadUpdated: str
    # districtUpdated: str
    # latUpdated: float
    # longUpdated: float
    docs: List[Documents] = Field(default_factory=list)
    photos: List[str] = Field(default_factory=list)
    familyMasterList:str

    currentStage:str
    currentSubStage: str

    updates:Optional[List[VillageUpdates]]= Field(default_factory=list)
    completed_substages:Optional[List[str]]=Field(default_factory=list)

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


class VillageDocInsert(BaseModel):
    name: str
    siteOfRelocation: str
    fd: str
    sd:str
    range:Optional[str]
    circle:Optional[str]
    beat:Optional[str]
    gramPanchayat: str
    tehsil: str
    janpad: str
    district: str
    lat: float
    long: float
    kml: str

    fdUpdated: str
    sdUpdated:str
    rangeUpdated:Optional[str]
    circleUpdated:Optional[str]
    beatUpdated:Optional[str]
    gramPanchayatUpdated: str
    tehsilUpdated: str
    janpadUpdated: str
    districtUpdated: str
    latUpdated: float
    longUpdated: float
    docs: List[Documents] =  Field(default_factory=list)
    photos: List[str] =  Field(default_factory=list)
    familyMasterList:str
    
    emp: List[str] = Field(default_factory=list)

    
    class Config:
        extra = "forbid"   # ❌ reject unknown fields
    # Example: ensure latitude/longitude look like numbers
   
   
   
    @field_validator("lat", "long","latUpdated","longUpdated")
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


class VillageDocUpdate(BaseModel):
    name: Optional[str]=None
    siteOfRelocation: Optional[str]=None
    fd: Optional[str]=None
    sd:Optional[str]=None
    range:Optional[str]=None
    circle:Optional[str]=None
    beat:Optional[str]=None
    gramPanchayat: Optional[str]=None
    tehsil: Optional[str]=None
    janpad: Optional[str]=None
    district: Optional[str]=None
    lat: Optional[float]=None
    long: Optional[float]=None
    kml: Optional[str]=None
    
    fdUpdated: Optional[str]=None
    sdUpdated:Optional[str]=None
    rangeUpdated:Optional[str]=None
    circleUpdated:Optional[str]=None
    beatUpdated:Optional[str]=None
    gramPanchayatUpdated: Optional[str]=None
    tehsilUpdated: Optional[str]=None
    janpadUpdated: Optional[str]=None
    districtUpdated: Optional[str]=None
    latUpdated: Optional[float]=None
    longUpdated: Optional[float]=None
    docs: Optional[List[Documents]] = None
    photos:Optional[ List[str]] =  None
    familyMasterList:Optional[str]=None
    
    emp: List[str] = Field(default_factory=list)

    
    class Config:
        extra = "forbid"   # ❌ reject unknown fields
    # Example: ensure latitude/longitude look like numbers
   
   
    
    @field_validator("lat", "long", "latUpdated", "longUpdated")
    @classmethod
    def validate_coordinates(cls, v):
        if v is None:   # ✅ allow null values
            return v
        try:
            return float(v)  # ✅ ensure numeric if provided
        except (TypeError, ValueError):
            raise ValueError("Latitude/Longitude must be numeric")

    # Function to validate a Mongo doc against this model
    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)



class VillageDocComplete(VillageDocInsert):
    villageId: str
    currentStage:str
    currentSubStage: str
    updates:Optional[List[VillageUpdates]]= Field(default_factory=list)
    completed_substages:Optional[List[str]]=Field(default_factory=list)
    delete:bool=False



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
    
class Logs(BaseModel):
    userId:str #new        meeting / family stage/community facility / family house
    updateTime: str
    comments: Optional[str] = None
    villageId:str
    type: Literal[
        'Village',
        'Community Facilities',
        'Meeting',
        'Houses',
        'Materials',
        'Facilities',
        'Feedback',
        'Families'
    ]
    action:Literal[
        'Insert',
        'Delete',
        'Edited',
        'Verification Insert',
        'Verification Edited',
        'Verification Deleted',
        'Action',
    ]
    relatedId:str #based on type and action