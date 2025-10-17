from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator, root_validator, validator
from typing import List, Optional
from utils.helpers import s3_url_pattern


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


class FieldLevelVerificationUpdate(BaseModel):
    
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


class FieldLevelVerification(FieldLevelVerificationInsert):
    
    type:str
    villageId:str
    plotId:str
    homeId:Optional[str]=None

    status:int
    verificationId:str
    verifiedAt:str
    verifiedBy:str
    insertedBy:str

    statusHistory:List[statusHistory]
    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ["house","plot"]:
            raise ValueError(f"type should be plot or house")
        return v
    # @model_validator(mode="after")
    # def check_home_for_house(cls, values):
    #     t = values.get("type")
    #     plot = values.get("plotId")
    #     home = values.get("homeId")
        
    #     if t == "house" and not home:
    #         raise ValueError("homeId is required when type is 'house'")
    #     if t == "plot" and home is not None:
    #         raise ValueError("homeId must be None when type is 'plot'")
    #     if not plot:
    #         raise ValueError("plotId is always required")
    #     return values

class PlotsInsert(BaseModel):
    name: str
    typeId: str            
    villageId: str   # required for community projects
    docs:List[str]=Field(default_factory=list)

    class Config:
        extra = "forbid"



class PlotsUpdate(BaseModel):
    name: Optional[str]
    typeId: Optional[str]  
    docs:List[str]=Field(default_factory=list)
          
    class Config:
        extra = "forbid"


class Plots(PlotsInsert):
    plotId:str
    currentStage:str
    stagesCompleted:Optional[List[str]]=Field(default_factory=list)
    deleted:bool=False

#house is also a type of plot but have some other properties so made it different !!!

class homeDetails(BaseModel):    #for insert update
    mukhiyaName:str
    familyId:str
    docs:List[str]=Field(default_factory=list)

    class Config:
        extra = "forbid"

class homeDetailsComplete(homeDetails):
    homeId:str
    currentStage:Optional[str]=""
    stagesCompleted:Optional[List[str]]=Field(default_factory=list)
    class Config:
        extra = "forbid"


class HouseInsert(BaseModel):
    mukhiyaName: str
    typeId: str            
    villageId: str   # required for community projects
    familyId: str    
    numberOfHome:int=1
    homeDetails:List[homeDetailsComplete]=Field(default_factory=list)
    class Config:
        extra = "forbid"

class HouseUpdate(BaseModel):
    mukhiyaName: Optional[str]=None
    familyId: Optional[str] = None    
    numberOfHome:int=1
    homeDetails:List[homeDetailsComplete]=Field(default_factory=list)

    class Config:
        extra = "forbid"


class House(HouseInsert):
    plotId:str
    deleted:bool=False

