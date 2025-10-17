from pydantic import BaseModel, Field, HttpUrl, field_validator, validator
from typing import Optional, List
from utils.helpers import s3_url_pattern

from pydantic_core import ValidationError

class StatusHistory(BaseModel):
    status:int
    comments:str
    verifier:str
    time: str          # ISO timestamp

class UpdatesInsert(BaseModel):
    currentStage:str
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

class UpdatesUpdate(BaseModel):
  #  currentStage:Optional[str]=None
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


class Updates(UpdatesInsert):

    villageId:str
    familyId:str 

    status:int
    updateId:str                   
    verifiedBy:str
    verifiedAt:str
    insertedBy:str
    insertedAt:str

    statusHistory:List[StatusHistory]


class FamilyCard(BaseModel):
    familyId:str
    mukhiyaName:str
    mukhiyaPhoto:str
    relocationOption:str

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)


class Member(BaseModel):
    name: str
    age: int
    gender: str
    healthIssues: Optional[str] = None
    photo: Optional[str] = None

    class Config:
        extra = "forbid"   # 🚫 reject unknown fields like "updates"




class Family(BaseModel):
    #familyId:str
    mukhiyaName:str
    mukhiyaPhoto:str
    relocationOption:str
    villageId:str
    mukhiyaHealth:str
    mukhiyaAge:str
    mukhiyaGender:str   
    lat:float   #new
    long:float   #new
    plotId:Optional[str]=None #new
    members:List[Member]=[]
    photos:List[str]=[]
    docs:List[str]=[]

    class Config:
        extra = "forbid"   # 🚫 reject unknown fields like "updates"

    # ✅ validation: mukhiyaAge must be numeric string
    @field_validator("mukhiyaAge")
    @classmethod
    def validate_mukhiya_age(cls, v: str) -> str:
        if not v.isdigit() and not (int(v) >= 18):
            raise ValueError("Mukhiya age must be numeric (string of digits) and greater than 18")
        return v

    # ✅ validation: lat must be -90 to 90
    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not (-90 <= v <= 90):
            raise ValueError("Latitude must be between -90 and 90")
        return v

    # ✅ validation: long must be -180 to 180
    @field_validator("long")
    @classmethod
    def validate_long(cls, v: float) -> float:
        if not (-180 <= v <= 180):
            raise ValueError("Longitude must be between -180 and 180")
        return v

    @field_validator("mukhiyaGender")
    @classmethod
    def validate_Gender(cls, v: str) -> str:
        if not (v.lower() in ["male","m"]):
            raise ValueError("Gender should be male or m")
        return v

class FamilyUpdate(BaseModel):
    #familyId: Optional[str] = None
    mukhiyaName: Optional[str] = None
    mukhiyaPhoto: Optional[str] = None
    relocationOption: Optional[str] = None
    villageId: Optional[str] = None
    mukhiyaHealth: Optional[str] = None
    mukhiyaAge: Optional[str] = None
    mukhiyaGender: Optional[str] = None   

    lat: Optional[float] = None
    long: Optional[float] = None
    plotId: Optional[str] = None
    members: Optional[List[Member]] = None   # or List[Members]
    photos: Optional[List[str]] = None
    docs: Optional[List[str]] = None
    class Config:
        extra = "forbid"   # 🚫 reject unknown fields like "updates"



    # ✅ validation: mukhiyaAge must be numeric string
    @field_validator("mukhiyaAge")
    @classmethod
    def validate_mukhiya_age(cls, v: str) -> str:
        if not v.isdigit() and not (int(v) >= 18):
            raise ValueError("Mukhiya age must be numeric (string of digits) and greater than 18")
        return v


    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-90 <= v <= 90):
            raise ValueError("Latitude must be between -90 and 90")
        return v

    @field_validator("long")
    @classmethod
    def validate_long(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-180 <= v <= 180):
            raise ValueError("Longitude must be between -180 and 180")
        return v

    @field_validator("mukhiyaGender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        if not (v.lower() in ["male","m"]):
            raise ValueError("Gender should be male or m")
        return v
    
class FamilyComplete(Family):
    familyId:str
    currentStage:str
    #updates:List[Updates]= Field(default_factory=list)
    stagesCompleted:List[str]=Field(default_factory=list)
    members: List[Member] = Field(default_factory=list)  

