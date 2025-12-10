

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, RootModel


class UserRole(str, Enum):
    ADMIN = "admin"
    forestguard = "fg"
    rangeAssistant = "ra"
    rangeOfficer = "ro"
    assistantDirector="ad"
    deputyDirector="dd"


class UserCounters(BaseModel):
    houseInsert:int=0
    plotInsert:int=0
    houseVerifications: int = 0
    plotVerifications: int = 0
    facilityUpdates: int = 0
    materialUpdatesHouse: int = 0
    materialUpdatesPlot: int = 0
    familyUpdates: int = 0
    meetingsAttended:int=0
    houseD: int = 0
    plotD: int = 0
    houseVerificationsD:int=0
    plotVerificationsD: int = 0
    facilityUpdatesD: int = 0
    materialUpdatesHouseD: int = 0
    materialUpdatesPlotD: int = 0
    familyUpdatesD: int = 0
    
class UserVillageCounters(RootModel[Dict[str, UserCounters]]):
    pass

class UserInsert(BaseModel):
    email: str
    name: str
    role: UserRole
    mobile: str
    villageID:List[str]= Field(default_factory=list)
    activated:Optional[bool]=True
    deleted:Optional[bool]=False

    class Config:
        extra = "forbid"  

class UserUpdate(BaseModel):
    email:  Optional[str]=None
    name:  Optional[str]=None
    #role: UserRole
    mobile:  Optional[str]=None
    villageID:Optional[List[str]]= None
    activated:Optional[bool]=False
    deleted:Optional[bool]=False

    class Config:
        extra = "forbid"  

class Users(UserInsert):
    userId:str
    password:str
    verified:bool
    userCounters: UserVillageCounters = Field(default_factory=lambda: UserVillageCounters({}))

    @classmethod
    def from_mongo(cls, doc: dict):
        if not doc:
            return None
        # remove _id if present
        doc.pop("_id", None)
        return cls.parse_obj(doc)   # validates against schema
    

class UsersForApp(UserInsert):
    userId:str
    password:str
    verified:bool
    #userCounters: UserVillageCounters = Field(default_factory=lambda: UserVillageCounters({}))

    @classmethod
    def from_mongo(cls, doc: dict):
        if not doc:
            return None
        # remove _id if present
        doc.pop("_id", None)
        return cls.parse_obj(doc)   # validates against schema