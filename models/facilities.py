from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator, root_validator, validator
from typing import List, Optional
from utils.helpers import s3_url_pattern
from models.stages import statusHistory

class FacilityInsert(BaseModel):
    name: str             
    villageId:str
    class Config:
        extra = "forbid"   # ❌ reject unknown fields

    
    @field_validator("villageId")
    @classmethod
    def validate_villageId_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("village name cannot be empty if provided")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("name cannot be empty if provided")
        return v

class FacilityUpdate(BaseModel):
    name: Optional[str] = None
    villageId: Optional[str] = None  # make sure default=None

    class Config:
        extra = "forbid"

class Facility(FacilityInsert):
    facilityId:str
    deleted:bool=False



class FacilityVerificationInsert(BaseModel):
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


class FacilityVerificationUpdate(BaseModel):
    
    name:Optional[str]  =None
    docs:Optional[List[str]]=Field(default_factory=list)
    notes:Optional[str]  =None
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


class FacilityVerification(FacilityVerificationInsert):
    
    villageId:str
    facilityId:str
    status:int
    verificationId:str
    verifiedAt:str
    verifiedBy:str
    insertedBy:str

    statusHistory:List[statusHistory]
