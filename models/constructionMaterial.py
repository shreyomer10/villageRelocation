from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator, root_validator, validator
from typing import List, Optional
from models.stages import statusHistory
from utils.helpers import s3_url_pattern

class MaterialInsert(BaseModel):
    name:str
    desc: Optional[str] = None
    class Config:
        extra = "forbid"   


class MaterialUpdate(BaseModel):
    name:Optional[str]
    desc: Optional[str] = None
    class Config:
        extra = "forbid"  

class Material(MaterialInsert):
    materialId:str


class MaterialUpdateInsert(BaseModel):
    type:str # (house or plot)
    materialId:str
    villageId:str
    qty:str
    unit:str
    notes:str
    docs:List[str]=Field(default_factory=list)
    
    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ["house","plot"]:
            raise ValueError(f"type should be plot or house")
        return v
    
    
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

class MaterialUpdateUpdate(BaseModel):
    type:Optional[str] # (house or plot)
    materialId:Optional[str] 
    villageId:str
    notes:Optional[str] 

    qty:Optional[str] 
    unit:Optional[str] 
    docs:Optional[List[str]]=Field(default_factory=list)
    
    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ["house","plot"]:
            raise ValueError(f"type should be plot or house")
        return v
    
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

class MaterialUpdates(MaterialUpdateInsert):
    updateId:str
    status:int
    verifiedAt:str
    verifiedBy:str
    insertedBy:str
    insertedAt:str

    statusHistory:List[statusHistory]