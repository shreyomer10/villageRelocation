from pydantic import BaseModel, Field, HttpUrl, field_validator, validator
from typing import List, Optional


class OprionStageInsert(BaseModel):
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

    

class OprionStageUpdate(BaseModel):
    name: Optional[str]
    desc: Optional[str] = None
    deleted:bool=False
    position: Optional[int] = None  # ✅ new: position index

    class Config:
        extra = "forbid"   # ❌ reject unknown fields

    

class OprionStage(OprionStageInsert):
    stageId:str

class OptionInsert(BaseModel):
    name: str
    desc: Optional[str] = None
    stages: List[OprionStageInsert]= Field(default_factory=list)
    deleted:bool=False
  #  position: Optional[int] = None  # ✅ new: position index

    class Config:
        extra = "forbid"   # ❌ reject unknown fields

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Stage name cannot be empty if provided")
        return v

class Options(OptionInsert):
    optionId:str



class OptionUpdate(BaseModel):
    name: Optional[str]
    desc: Optional[str] = None
    deleted:bool=False
  #  position: Optional[int] = None  # ✅ new: position index

    class Config:
        extra = "forbid"   # ❌ reject unknown fields
    



class BuildingStagesInsert(BaseModel):
    name: str            
    desc:Optional[str]=None
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

class BuildingStagesUpdate(BaseModel):
    name: Optional[str]=None           
    desc:Optional[str]=None
    deleted:bool=False
    class Config:
        extra = "forbid"   # ❌ reject unknown fields

class BuildingStages(BuildingStagesInsert):
    stageId:str

class BuildingInsert(BaseModel):
    name: str             
    stages: List[BuildingStagesInsert] = Field(default_factory=list)
    deleted:bool=False
    villageId:str
    class Config:
        extra = "forbid"   # ❌ reject unknown fields

    
    @field_validator("villageId")
    @classmethod
    def validate_villageId_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Stage name cannot be empty if provided")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Stage name cannot be empty if provided")
        return v

class BuildingUpdate(BaseModel):
    name: Optional[str]=None  
    deleted:bool=False
    villageId:Optional[str]=None
    stages: Optional[List[BuildingStagesUpdate]] = None   

    class Config:
        extra = "forbid"   # ❌ reject unknown fields

class Building(BuildingInsert):
    typeId:str


class statusHistory(BaseModel):
    status:int
    comments:str
    verifier:str
    time: str          # ISO timestamp



class FieldLevelVerificationInsert(BaseModel):
    currentStage:str  #new
    name:str
    docs:List[str]=Field(default_factory=list)
    notes:str
    class Config:
        extra = "forbid"


class FieldLevelVerificationUpdate(BaseModel):
    currentStage:Optional[str] =None#new
    name:Optional[str]  =None
    docs:Optional[List[str]]=Field(default_factory=list)
    notes:Optional[str]  =None
    class Config:
        extra = "forbid"



class FieldLevelVerification(FieldLevelVerificationInsert):
    status:int
    verificationId:str
    verifiedAt:str
    verifiedBy:str
    insertedBy:str

    statusHistory:List[statusHistory]


class PlotsInsert(BaseModel):
    name: str
    typeId: str            
    villageId: str   # required for community projects
    familyId: Optional[str] = None    
    stagesCompleted:Optional[List[str]]=Field(default_factory=list)
    docs: Optional[List[FieldLevelVerificationInsert]] = Field(default_factory=list)
    deleted:bool=False
    class Config:
        extra = "forbid"



class PlotsUpdate(BaseModel):
    name: Optional[str]
    typeId: Optional[str]            
    villageId: Optional[str]   # required for community projects
    familyId: Optional[str] = None    
    stagesCompleted:Optional[List[str]]=Field(default_factory=list)
    docs: Optional[List[FieldLevelVerification]] = Field(default_factory=list)
    deleted:bool=False
    class Config:
        extra = "forbid"


class Plots(PlotsInsert):
    plotId:str
